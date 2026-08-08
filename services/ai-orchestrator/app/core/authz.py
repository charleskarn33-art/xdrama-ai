from typing import Annotated

from fastapi import Depends, HTTPException, status
from supabase import AsyncClient

from app.core.auth import AuthenticatedUser, verify_supabase_jwt
from app.core.supabase import get_service_client


async def require_platform_admin(
    user: Annotated[AuthenticatedUser, Depends(verify_supabase_jwt)],
    supabase: Annotated[AsyncClient, Depends(get_service_client)],
) -> AuthenticatedUser:
    """Verifies the caller is a platform admin, independent of their own
    RLS grants — this service always checks with the service-role client
    rather than trusting a claim embedded in the JWT, since profiles.
    is_platform_admin can change after a token was issued."""
    response = (
        await supabase.table("profiles")
        .select("is_platform_admin")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )

    profile = response.data if response else None
    is_admin = isinstance(profile, dict) and bool(profile.get("is_platform_admin"))

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )

    return user
