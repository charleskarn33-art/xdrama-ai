import os
import time
from typing import Any

# Must be set before `app.main` is imported: the app's lifespan constructs
# a Supabase client at startup (see app/core/supabase.py), which requires
# a non-empty key even though nothing here talks to a real Supabase
# instance — supabase-py validates this eagerly at construction time.
TEST_JWT_SECRET = "test-jwt-secret"
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)

import pytest  # noqa: E402
import redis.asyncio as redis  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def redis_available() -> None:
    """Skips the test if Redis isn't reachable, and flushes the test db
    first — a throwaway local Redis, same posture as the throwaway
    Postgres database supabase/tests/run_tests.sh recreates every run, so
    one test's leftover queue entries can't affect another's."""
    client = redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        await client.ping()
    except Exception:
        pytest.skip("Redis is not reachable at REDIS_URL")
    await client.flushdb()
    await client.aclose()


def make_token(**overrides: Any) -> str:
    payload = {
        "sub": "00000000-0000-0000-0000-000000000000",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
