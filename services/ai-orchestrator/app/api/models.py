from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.authz import require_platform_admin
from app.core.config import Settings, get_settings
from app.core.supabase import get_service_client
from app.models.registry import ModelActionResult

router = APIRouter(prefix="/v1/models", tags=["models"])


async def _get_model_or_404(supabase: AsyncClient, model_id: str) -> dict[str, Any]:
    response = (
        await supabase.table("ai_models").select("*").eq("id", model_id).maybe_single().execute()
    )
    data = response.data if response else None
    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return data


async def _dispatch_to_render_node(node_url: str, model: dict[str, Any], action: str) -> None:
    """Dispatches an install/uninstall/health-check request to a GPU render
    node. Not implemented: no render node agent API has been designed yet
    — that's Module 8's job (AI Workflow Engine), once real GPU
    infrastructure exists to design the contract against. Inventing one
    now would mean building against an API no real system implements."""
    raise NotImplementedError(f"Render node dispatch ({action}) is not implemented yet")


@router.post("/{model_id}/install", response_model=ModelActionResult)
async def install_model(
    model_id: str,
    _admin: Annotated[object, Depends(require_platform_admin)],
    supabase: Annotated[AsyncClient, Depends(get_service_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ModelActionResult:
    """Downloads (or re-downloads, for updates) a model's weights onto a
    GPU render node. Requires RENDER_NODE_URLS to be configured."""
    model = await _get_model_or_404(supabase, model_id)

    if not settings.render_nodes:
        await supabase.table("ai_models").update({"install_status": "failed"}).eq(
            "id", model_id
        ).execute()
        return ModelActionResult(
            ok=False,
            install_status="failed",
            message="No render nodes configured (RENDER_NODE_URLS is empty). "
            "Attach a GPU node to enable installs.",
        )

    try:
        await _dispatch_to_render_node(settings.render_nodes[0], model, "install")
    except NotImplementedError as exc:
        await supabase.table("ai_models").update({"install_status": "failed"}).eq(
            "id", model_id
        ).execute()
        return ModelActionResult(ok=False, install_status="failed", message=str(exc))

    # Unreachable until _dispatch_to_render_node is implemented (Module 8),
    # kept complete so the success path/response shape is real, not a stub.
    await supabase.table("ai_models").update({"install_status": "installed"}).eq(
        "id", model_id
    ).execute()
    return ModelActionResult(ok=True, install_status="installed", message="Installed.")


@router.post("/{model_id}/uninstall", response_model=ModelActionResult)
async def uninstall_model(
    model_id: str,
    _admin: Annotated[object, Depends(require_platform_admin)],
    supabase: Annotated[AsyncClient, Depends(get_service_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ModelActionResult:
    """Removes a model's downloaded weights from its assigned GPU render
    node and resets its registry status to not_installed."""
    model = await _get_model_or_404(supabase, model_id)

    if not settings.render_nodes:
        return ModelActionResult(
            ok=False,
            install_status=model["install_status"],
            message="No render nodes configured (RENDER_NODE_URLS is empty). "
            "Nothing to uninstall.",
        )

    try:
        await _dispatch_to_render_node(settings.render_nodes[0], model, "uninstall")
    except NotImplementedError as exc:
        return ModelActionResult(
            ok=False, install_status=model["install_status"], message=str(exc)
        )

    await supabase.table("ai_models").update(
        {"install_status": "not_installed", "is_enabled": False}
    ).eq("id", model_id).execute()
    return ModelActionResult(ok=True, install_status="not_installed", message="Uninstalled.")


@router.post("/{model_id}/health-check", response_model=ModelActionResult)
async def health_check_model(
    model_id: str,
    _admin: Annotated[object, Depends(require_platform_admin)],
    supabase: Annotated[AsyncClient, Depends(get_service_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ModelActionResult:
    """Pings the GPU render node a model is assigned to and updates its
    health_status. Requires RENDER_NODE_URLS to be configured."""
    model = await _get_model_or_404(supabase, model_id)
    now = datetime.now(UTC).isoformat()

    if not settings.render_nodes:
        await supabase.table("ai_models").update(
            {"health_status": "unknown", "last_health_check_at": now}
        ).eq("id", model_id).execute()
        return ModelActionResult(
            ok=False,
            health_status="unknown",
            message="No render nodes configured (RENDER_NODE_URLS is empty).",
        )

    try:
        await _dispatch_to_render_node(settings.render_nodes[0], model, "health-check")
    except NotImplementedError as exc:
        await supabase.table("ai_models").update(
            {"health_status": "unknown", "last_health_check_at": now}
        ).eq("id", model_id).execute()
        return ModelActionResult(ok=False, health_status="unknown", message=str(exc))

    await supabase.table("ai_models").update(
        {"health_status": "healthy", "last_health_check_at": now}
    ).eq("id", model_id).execute()
    return ModelActionResult(ok=True, health_status="healthy", message="Healthy.")
