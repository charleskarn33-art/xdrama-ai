"""Test double for AIComputeProvider — lets render_jobs.py's dispatch
tests exercise the real branching logic (configured vs not, success vs a
real-shaped provider failure) without ever touching the network or the
actual modal package's client."""

from __future__ import annotations

from app.core.compute.base import (
    AIComputeProvider,
    ComputeJobHandle,
    ComputeJobSpec,
    ComputeProviderError,
)


class FakeComputeProvider(AIComputeProvider):
    def __init__(self, *, fail_with: str | None = None, provider_job_id: str = "fc-123") -> None:
        self.fail_with = fail_with
        self.provider_job_id = provider_job_id
        self.submitted: list[ComputeJobSpec] = []

    async def submit(self, spec: ComputeJobSpec) -> ComputeJobHandle:
        self.submitted.append(spec)
        if self.fail_with is not None:
            raise ComputeProviderError(self.fail_with)
        return ComputeJobHandle(provider_job_id=self.provider_job_id)

    async def get_status(self, provider_job_id: str) -> str:
        return "completed"

    async def cancel(self, provider_job_id: str) -> None:
        return None
