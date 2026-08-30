from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment variables / .env.

    supabase_service_role_key is used only by trusted, server-side actions
    that need to write past a caller's own RLS grants (e.g. the AI Model
    Manager's install/health-check endpoints, which write to the
    platform-level ai_models table after this service has independently
    verified the caller is a platform admin — see app/core/authz.py). It
    is never read from a request and never returned in a response.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    supabase_url: str = "http://localhost:54321"
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    # Public anon key, safe to ship to a browser — used to build per-request
    # clients scoped to the calling user's own JWT (see
    # app/core/supabase.py's get_user_scoped_client), not privilege
    # escalation like the service-role key.
    supabase_anon_key: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # Comma-separated list of ComfyUI-capable render node base URLs, used
    # only by the AI Model Manager's install/uninstall/health-check
    # endpoints (app/api/models.py) — a Module 6 integration point that
    # predates Module 17's compute-provider abstraction and hasn't been
    # migrated onto it (see docs/17-module-17-modal-gpu-compute-
    # provider.md). Empty means no such node is attached; those endpoints
    # report that honestly rather than simulating work that can't happen.
    render_node_urls: str = ""

    # Which AIComputeProvider implementation app/api/render_jobs.py
    # dispatches generation jobs to (see app/core/compute/). "modal" is
    # the only implementation that exists; the field is still a string,
    # not a hardcoded constant, so adding a second provider later is a
    # new branch in app/core/compute/factory.py, not a schema change.
    ai_compute_provider: str = "modal"
    modal_token_id: str = ""
    modal_token_secret: str = ""

    cors_allow_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def render_nodes(self) -> list[str]:
        return [url.strip() for url in self.render_node_urls.split(",") if url.strip()]

    @property
    def modal_configured(self) -> bool:
        return bool(self.modal_token_id.strip() and self.modal_token_secret.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
