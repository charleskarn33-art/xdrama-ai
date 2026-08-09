from typing import Annotated, cast

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AsyncClient, create_async_client

from app.core.auth import AuthenticatedUser, verify_supabase_jwt
from app.core.config import get_settings

_bearer_scheme = HTTPBearer(auto_error=False)


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
    """FastAPI dependency: retrieves the shared service-role client
    created at startup."""
    return cast(AsyncClient, request.app.state.supabase)


async def get_user_scoped_client(
    _user: Annotated[AuthenticatedUser, Depends(verify_supabase_jwt)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> AsyncClient:
    """A Supabase client acting as the calling user, subject to their own
    RLS grants — not the service-role client.

    Built fresh per request (never cached/shared): mutating a shared
    client's auth header per request would race under concurrent
    requests, each request needs its own client instance. Use this
    instead of the service-role client whenever the caller's own RLS
    grants already cover the operation (e.g. render_jobs, which any
    project member can read/update) — it means the authorization check
    *is* the RLS policy, not reimplemented Python logic that could drift
    from it.
    """
    settings = get_settings()
    client = await create_async_client(settings.supabase_url, settings.supabase_anon_key)
    if credentials:
        client.postgrest.auth(credentials.credentials)
    return client
