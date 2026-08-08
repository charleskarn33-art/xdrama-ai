from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, verify_supabase_jwt

router = APIRouter(tags=["auth"])


@router.get("/v1/me", response_model=AuthenticatedUser)
async def me(
    user: Annotated[AuthenticatedUser, Depends(verify_supabase_jwt)],
) -> AuthenticatedUser:
    """Reference endpoint proving the orchestrator independently verifies
    Supabase JWTs. Real orchestration routes (Module 8+) depend on the same
    verify_supabase_jwt dependency."""
    return user
