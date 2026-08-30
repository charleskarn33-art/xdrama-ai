from typing import Annotated

from fastapi import Depends

from app.core.compute.base import AIComputeProvider, ComputeProviderError
from app.core.compute.modal_provider import ModalComputeProvider
from app.core.config import Settings, get_settings


def get_compute_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AIComputeProvider:
    """The single place a new AIComputeProvider gets wired in. Adding
    RunPod/AWS/Lambda/Vast.ai/a dedicated GPU server later means a new
    branch here and a new AI_COMPUTE_PROVIDER value — app/api/render_jobs.py
    never changes.

    Only reached once app/api/render_jobs.py has already confirmed
    settings.modal_configured (for the 'modal' provider) — this factory
    doesn't re-check that, so it always attempts to construct a real
    client rather than silently returning something inert.
    """
    if settings.ai_compute_provider == "modal":
        return ModalComputeProvider(settings.modal_token_id, settings.modal_token_secret)
    raise ComputeProviderError(f"Unknown AI_COMPUTE_PROVIDER '{settings.ai_compute_provider}'")
