from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.db import get_row_or_404
from app.core.supabase import get_user_scoped_client
from app.models.suggestion import SuggestionResult

router = APIRouter(prefix="/v1/suggestions", tags=["suggestions"])


async def _fail_suggestion(
    supabase: AsyncClient, suggestion_id: str, message: str
) -> SuggestionResult:
    await supabase.table("ai_suggestions").update(
        {"status": "failed", "error_message": message}
    ).eq("id", suggestion_id).execute()
    return SuggestionResult(ok=False, status="failed", message=message)


async def _generate_llm_suggestions(model_slug: str, prompt: str) -> dict[str, Any]:
    """Calls an installed LLM model to generate advisor suggestions. Not
    implemented: the Model Manager tracks models installed on the
    platform operator's own GPU infrastructure (see Module 6), and no
    such infrastructure — or any hosted LLM API integration, which the
    product brief's architecture never specifies — exists in this
    deployment. Real infrastructure follow-up, not buildable today."""
    raise NotImplementedError("LLM inference is not implemented yet")


@router.post("/{suggestion_id}/generate", response_model=SuggestionResult)
async def generate_suggestion(
    suggestion_id: str,
    supabase: Annotated[AsyncClient, Depends(get_user_scoped_client)],
) -> SuggestionResult:
    """Generates advisor suggestions for a pending ai_suggestions request.

    Uses a client scoped to the caller's own JWT, not the service-role
    client: any project member may request suggestions for their project
    (the same rule ai_suggestions' RLS UPDATE policy already grants), so
    the authorization check *is* the RLS policy — the same reasoning as
    render_jobs' dispatch endpoint.
    """
    suggestion = await get_row_or_404(supabase, "ai_suggestions", suggestion_id)

    if suggestion["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Suggestion request is '{suggestion['status']}', not 'pending'",
        )

    task_type = f"{suggestion['role']}_suggestions"

    model_response = await supabase.rpc(
        "select_model_for_task", {"p_task_type": task_type}
    ).execute()
    model = model_response.data if model_response else None

    if not isinstance(model, dict) or not model.get("id"):
        return await _fail_suggestion(
            supabase,
            suggestion_id,
            f"No eligible model installed for '{task_type}'. Install and enable an LLM "
            "model in the AI Model Manager to enable suggestions.",
        )

    try:
        result = await _generate_llm_suggestions(model["slug"], suggestion["prompt"])
    except NotImplementedError as exc:
        return await _fail_suggestion(supabase, suggestion_id, str(exc))

    now = datetime.now(UTC).isoformat()
    await supabase.table("ai_suggestions").update(
        {"status": "completed", "result": result, "completed_at": now}
    ).eq("id", suggestion_id).execute()
    return SuggestionResult(ok=True, status="completed", message="Suggestions generated.")
