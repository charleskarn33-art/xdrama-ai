from typing import cast

from fastapi import Request
from supabase import AsyncClient, create_async_client

from app.core.config import get_settings


async def create_service_client() -> AsyncClient:
    """Service-role Supabase client — bypasses RLS entirely.

    Created once at app startup (see app/main.py's lifespan) and reused
    across requests. Only for use after this service has independently
    authorized the caller (see app/core/authz.py) — never constructed
    from or exposed to per-request user input.
    """
    settings = get_settings()
    return await create_async_client(settings.supabase_url, settings.supabase_service_role_key)


def get_service_client(request: Request) -> AsyncClient:
    """FastAPI dependency: retrieves the shared client created at startup."""
    return cast(AsyncClient, request.app.state.supabase)
