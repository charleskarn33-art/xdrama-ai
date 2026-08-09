from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from supabase import AsyncClient

from app.core.config import Settings, get_settings
from app.core.db import get_row_or_404
from app.core.queue import dequeue_render_job, enqueue_render_job
from app.core.supabase import get_user_scoped_client
from app.models.render import DispatchResult
from app.workflows.comfyui_compiler import compile_to_comfyui
from app.workflows.graph import GraphCycleError, WorkflowGraph

router = APIRouter(prefix="/v1/render-jobs", tags=["render-jobs"])


async def _fail_job(supabase: AsyncClient, job_id: str, message: str) -> DispatchResult:
    await supabase.table("render_jobs").update(
        {"status": "failed", "error_message": message}
    ).eq("id", job_id).execute()
    return DispatchResult(ok=False, status="failed", message=message)


async def _dispatch_compiled_workflow(node_url: str, compiled: dict[str, Any]) -> None:
    """Submits a compiled ComfyUI prompt to a GPU render node. Not
    implemented: no render node exists to submit to yet, and no render
    node agent API has been designed (see the equivalent note in Module
    6's app/api/models.py) — real infrastructure follow-up, not
    buildable today."""
    raise NotImplementedError("Render node dispatch is not implemented yet")


@router.post("/{job_id}/dispatch", response_model=DispatchResult)
async def dispatch_render_job(
    job_id: str,
    supabase: Annotated[AsyncClient, Depends(get_user_scoped_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DispatchResult:
    """Compiles a render job's workflow and attempts to dispatch it to a
    GPU render node.

    Uses a client scoped to the caller's own JWT, not the service-role
    client: any project member may dispatch a job for their project (the
    same rule render_jobs' RLS UPDATE policy already grants), so the
    authorization check *is* the RLS policy — reading/writing through a
    user-scoped client means there's no separate Python authorization
    logic that could drift from it. Contrast with Module 6's install/
    health-check, which needed the service-role client specifically
    because platform-admin-only writes require bypassing a regular
    caller's RLS grants.
    """
    job = await get_row_or_404(supabase, "render_jobs", job_id)

    if job["status"] != "queued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is '{job['status']}', not 'queued'",
        )

    workflow = await get_row_or_404(supabase, "workflows", job["workflow_id"], select="graph")

    try:
        graph = WorkflowGraph.model_validate(workflow["graph"])
        compiled = compile_to_comfyui(graph)
    except (ValidationError, GraphCycleError) as exc:
        return await _fail_job(supabase, job_id, f"Invalid workflow graph: {exc}")

    if not settings.render_nodes:
        return await _fail_job(
            supabase,
            job_id,
            "No render nodes configured (RENDER_NODE_URLS is empty). "
            "Attach a GPU node to enable rendering.",
        )

    # Prove the queue round-trip for real rather than assuming a worker
    # will eventually consume it — see app/core/queue.py's dequeue
    # docstring for why nothing runs continuously yet.
    await enqueue_render_job(job_id)
    dequeued_id = await dequeue_render_job(timeout=5)
    if dequeued_id != job_id:
        return await _fail_job(supabase, job_id, "Render queue did not return the enqueued job")

    try:
        await _dispatch_compiled_workflow(settings.render_nodes[0], compiled)
    except NotImplementedError as exc:
        return await _fail_job(supabase, job_id, str(exc))

    now = datetime.now(UTC).isoformat()
    await supabase.table("render_jobs").update({"status": "running", "started_at": now}).eq(
        "id", job_id
    ).execute()
    return DispatchResult(ok=True, status="running", message="Dispatched.")
