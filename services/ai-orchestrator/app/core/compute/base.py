from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ComputeJobSpec:
    """What a render job needs a compute provider to run: the compiled
    ComfyUI prompt graph from app/workflows/comfyui_compiler.py, keyed to
    the render_jobs row it came from."""

    job_id: str
    compiled_workflow: dict[str, Any]


@dataclass(frozen=True)
class ComputeJobHandle:
    """A provider's own reference to a submitted job — a Modal
    FunctionCall id today. Stored on render_jobs.provider_job_id so a
    later status check or cancellation can look the job back up."""

    provider_job_id: str


class ComputeProviderError(Exception):
    """Raised when a provider genuinely can't accept or find a job: not
    configured, auth rejected, the target function/app doesn't exist. This
    is a real, provider-reported condition surfaced to the caller — never
    raised to paper over an untested code path (see ModalComputeProvider,
    which raises it from real modal.exception subclasses only)."""


class AIComputeProvider(ABC):
    """The one interface every GPU-compute backend implements, so
    swapping providers (Modal today; RunPod/AWS/Lambda/Vast.ai/a
    dedicated GPU server later — see docs/17-module-17-modal-gpu-compute-
    provider.md) never means rewriting app/api/render_jobs.py, only
    adding a new subclass here and a branch in factory.py."""

    @abstractmethod
    async def submit(self, spec: ComputeJobSpec) -> ComputeJobHandle:
        """Hands a compiled workflow off for GPU execution. Raises
        ComputeProviderError if the provider can't accept it right now."""

    @abstractmethod
    async def get_status(self, provider_job_id: str) -> str:
        """Returns the provider's own view of a previously submitted
        job's state (provider-specific string — e.g. Modal's
        pending/running/completed). Not currently polled by any endpoint;
        the compute provider itself is expected to write render_jobs.stage
        directly (see comfyui_app.py) since it holds the long-lived
        connection, not the orchestrator. Kept on the interface because
        every real provider needs *a* way to answer "is this job done,"
        and a future provider without push-based updates will need it."""

    @abstractmethod
    async def cancel(self, provider_job_id: str) -> None:
        """Requests cancellation of an in-flight job. Not wired to an
        HTTP endpoint yet — render_jobs.status can already be set to
        'cancelled' directly by any project member (Module 8's RLS), which
        stops nothing running on the provider side today since nothing
        provider-side has ever actually run; this becomes real once a
        cancel action needs to reach the provider, not just the row."""
