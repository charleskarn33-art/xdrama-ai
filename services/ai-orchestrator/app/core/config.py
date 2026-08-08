from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, sourced from environment variables / .env.

    This service never receives the Supabase service-role key implicitly —
    it only verifies JWTs issued by Supabase Auth using the project's JWT
    secret, and calls out to Postgres/Storage with the minimum privilege
    each operation needs.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    supabase_url: str = "http://localhost:54321"
    supabase_jwt_secret: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # Comma-separated list of ComfyUI-capable render node base URLs. The AI
    # Model Manager (Module 6) replaces this with a live, health-checked
    # registry — this is a placeholder for local development only.
    render_node_urls: str = ""

    cors_allow_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
