from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.db import get_row_or_404
from app.core.supabase import get_user_scoped_client
from app.models.export import ExportResult

router = APIRouter(prefix="/v1/export-jobs", tags=["export-jobs"])


async def _fail_export(supabase: AsyncClient, export_job_id: str, message: str) -> ExportResult:
    await supabase.table("export_jobs").update(
        {"status": "failed", "error_message": message}
    ).eq("id", export_job_id).execute()
    return ExportResult(ok=False, status="failed", message=message)


async def _composite_export(rendered_clips: list[dict[str, Any]]) -> str:
    """Concatenates a timeline's completed rendered clips into one
    exported file at the job's preset format. Not implemented: no
    media-processing service (e.g. an ffmpeg-based compositor) exists in
    this deployment to actually do this — real infrastructure
    follow-up, not buildable today, the same honest gap as GPU render
    dispatch and LLM inference."""
    raise NotImplementedError("Export compositing is not implemented yet")


@router.post("/{export_job_id}/dispatch", response_model=ExportResult)
async def dispatch_export_job(
    export_job_id: str,
    supabase: Annotated[AsyncClient, Depends(get_user_scoped_client)],
) -> ExportResult:
    """Attempts to composite a movie timeline's rendered clips into one
    exported file.

    Uses a client scoped to the caller's own JWT, not the service-role
    client: any project member may dispatch an export for their project
    (the same rule export_jobs' RLS UPDATE policy already grants), the
    same reasoning as render_jobs' and suggestions' dispatch endpoints.
    """
    job = await get_row_or_404(supabase, "export_jobs", export_job_id)

    if job["status"] != "queued":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Export job is '{job['status']}', not 'queued'",
        )

    clips_response = await (
        supabase.table("timeline_clips")
        .select("id, source_render_job_id")
        .eq("timeline_id", job["timeline_id"])
        .execute()
    )
    clips: list[dict[str, Any]] = [
        c for c in (clips_response.data or []) if isinstance(c, dict)
    ]
    render_job_ids = [c["source_render_job_id"] for c in clips if c.get("source_render_job_id")]

    if not render_job_ids:
        return await _fail_export(
            supabase,
            export_job_id,
            "No rendered clips available to export yet. Attach a source render job "
            "to at least one clip once real video has been generated for it.",
        )

    render_jobs_response = await (
        supabase.table("render_jobs")
        .select("id, status, output_asset_url")
        .in_("id", render_job_ids)
        .execute()
    )
    render_jobs: list[dict[str, Any]] = [
        r for r in (render_jobs_response.data or []) if isinstance(r, dict)
    ]
    completed = [
        r for r in render_jobs if r.get("status") == "completed" and r.get("output_asset_url")
    ]

    if not completed:
        return await _fail_export(
            supabase,
            export_job_id,
            "This timeline's clips reference render jobs, but none has completed "
            "with a real output asset yet.",
        )

    try:
        output_asset_url = await _composite_export(completed)
    except NotImplementedError as exc:
        return await _fail_export(supabase, export_job_id, str(exc))

    now = datetime.now(UTC).isoformat()
    await supabase.table("export_jobs").update(
        {"status": "completed", "output_asset_url": output_asset_url, "completed_at": now}
    ).eq("id", export_job_id).execute()
    return ExportResult(ok=True, status="completed", message="Export complete.")
