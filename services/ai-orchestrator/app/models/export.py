from pydantic import BaseModel


class ExportResult(BaseModel):
    """Result of dispatching an export job.

    `ok=False` with a message is the honest, expected outcome when a
    timeline's clips have no completed rendered source asset to
    composite, or when one exists but no media-processing service is
    wired up to actually composite it — both are normal states to
    report, not server errors. Same shape as render_jobs' DispatchResult.
    """

    ok: bool
    status: str
    message: str
