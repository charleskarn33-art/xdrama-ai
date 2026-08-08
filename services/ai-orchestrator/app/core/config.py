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

    redis_url: str = "redis://localhost:6379/0"

    # Comma-separated list of ComfyUI-capable render node base URLs. Empty
    # means no GPU infrastructure is attached yet — install/health-check
    # requests report that honestly (see app/api/models.py) rather than
    # simulating work that can't actually happen.
    render_node_urls: str = ""

    cors_allow_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def render_nodes(self) -> list[str]:
        return [url.strip() for url in self.render_node_urls.split(",") if url.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
