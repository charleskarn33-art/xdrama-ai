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
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def make_token(**overrides: Any) -> str:
    payload = {
        "sub": "00000000-0000-0000-0000-000000000000",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")
