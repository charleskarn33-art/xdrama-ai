from pydantic import BaseModel


class SuggestionResult(BaseModel):
    """Result of generating advisor suggestions.

    `ok=False` with a message is the honest, expected outcome when no
    LLM model is installed, or when one is installed but no real
    inference backend exists to call — both are normal states to
    report, not server errors, so generate returns 200 with ok=False
    rather than a 5xx. Same shape as render_jobs' DispatchResult.
    """

    ok: bool
    status: str
    message: str
