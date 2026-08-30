import asyncio

import modal
from modal.exception import AuthError, NotFoundError
from modal.exception import ConnectionError as ModalConnectionError

from app.core.compute.base import (
    AIComputeProvider,
    ComputeJobHandle,
    ComputeJobSpec,
    ComputeProviderError,
)

# The Modal app/function names services/modal-worker/comfyui_app.py
# deploys under. Not configurable per-model yet: every model_task node in
# a compiled workflow is dispatched to this one entry point, which is
# itself responsible for interpreting the compiled graph's task types
# (see comfyui_app.py's own docstring for what that worker does and does
# not implement today).
MODAL_APP_NAME = "xdrama-comfyui-worker"
MODAL_FUNCTION_NAME = "generate"

# modal.Client.from_credentials() performs real network I/O (validating
# credentials against Modal's API) and, verified directly in this
# project's own dev environment, does not fail fast when that network
# path is unreachable — it hangs rather than raising. A dispatch endpoint
# must never hang on third-party infra, so every Modal SDK call in this
# module is wrapped in asyncio.wait_for() with this bound.
_MODAL_CALL_TIMEOUT_SECONDS = 15.0


class ModalComputeProvider(AIComputeProvider):
    """Submits compiled ComfyUI workflows to the xdrama-comfyui-worker
    Modal app for GPU execution — the Module 17 replacement for the
    dedicated-GPU-server assumption in the original architecture brief.

    Construction itself is cheap and does no I/O (just stores
    credentials) — every network call is deferred to the method that
    actually needs it and is timeout-guarded, so injecting this via
    FastAPI's Depends() on every dispatch request never risks a hang.

    There is deliberately no fallback path when Modal is unreachable or
    the target app was never deployed (which is the actual state of every
    environment this code has run in so far) — both are real conditions
    reported honestly via ComputeProviderError, not smoothed over.
    """

    def __init__(self, token_id: str, token_secret: str) -> None:
        self._token_id = token_id
        self._token_secret = token_secret

    async def _client(self) -> modal.Client:
        make_client = asyncio.to_thread(
            modal.Client.from_credentials, self._token_id, self._token_secret
        )
        try:
            return await asyncio.wait_for(make_client, timeout=_MODAL_CALL_TIMEOUT_SECONDS)
        except (TimeoutError, AuthError, ModalConnectionError) as exc:
            raise ComputeProviderError(
                f"Could not reach Modal within {_MODAL_CALL_TIMEOUT_SECONDS:.0f}s: {exc}. "
                "Check MODAL_TOKEN_ID/MODAL_TOKEN_SECRET and that this service has network "
                "access to Modal's API."
            ) from exc

    async def submit(self, spec: ComputeJobSpec) -> ComputeJobHandle:
        client = await self._client()
        function = modal.Function.from_name(
            MODAL_APP_NAME, MODAL_FUNCTION_NAME, client=client
        )
        try:
            call = await asyncio.wait_for(
                function.spawn.aio(job_id=spec.job_id, compiled_workflow=spec.compiled_workflow),
                timeout=_MODAL_CALL_TIMEOUT_SECONDS,
            )
        except (NotFoundError, AuthError, ModalConnectionError, TimeoutError) as exc:
            raise ComputeProviderError(
                f"Modal function '{MODAL_APP_NAME}/{MODAL_FUNCTION_NAME}' is unreachable: "
                f"{exc}. Deploy services/modal-worker/comfyui_app.py with `modal deploy` "
                "first."
            ) from exc
        return ComputeJobHandle(provider_job_id=call.object_id)

    async def get_status(self, provider_job_id: str) -> str:
        client = await self._client()
        call = await modal.FunctionCall.from_id.aio(provider_job_id, client=client)
        try:
            await call.get.aio(timeout=0)
        except TimeoutError:
            return "running"
        except Exception as exc:
            # The function's own failure (e.g. a real ComfyUI error), not
            # a problem with the provider itself — still surfaced through
            # the same ComputeProviderError channel as a dispatch failure.
            raise ComputeProviderError(f"Modal job {provider_job_id} failed: {exc}") from exc
        return "completed"

    async def cancel(self, provider_job_id: str) -> None:
        client = await self._client()
        call = await modal.FunctionCall.from_id.aio(provider_job_id, client=client)
        await call.cancel.aio()
