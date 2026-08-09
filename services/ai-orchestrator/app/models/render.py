from pydantic import BaseModel


class DispatchResult(BaseModel):
    """Result of dispatching a render job.

    `ok=False` with a message is the honest, expected outcome when no GPU
    render nodes are configured, or when the workflow graph doesn't
    compile — both are normal states to report, not server errors, so
    dispatch returns 200 with ok=False rather than a 5xx.
    """

    ok: bool
    status: str
    message: str
