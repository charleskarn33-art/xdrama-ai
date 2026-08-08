from pydantic import BaseModel


class ModelActionResult(BaseModel):
    """Result of an install/uninstall/health-check action.

    `ok=False` with a message is the honest, expected outcome when no GPU
    render nodes are configured (RENDER_NODE_URLS is empty) — that's a
    normal state for this deployment, not a server error, so these actions
    return 200 with ok=False rather than a 5xx.
    """

    ok: bool
    install_status: str | None = None
    health_status: str | None = None
    message: str
