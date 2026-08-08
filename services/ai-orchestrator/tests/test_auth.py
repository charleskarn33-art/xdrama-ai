import time

from fastapi.testclient import TestClient
from jose import jwt

from tests.conftest import make_token


def test_me_requires_bearer_token(client: TestClient) -> None:
    response = client.get("/api/v1/me")

    assert response.status_code == 401


def test_me_rejects_invalid_signature(client: TestClient) -> None:
    bad_token = jwt.encode(
        {"sub": "user-1", "aud": "authenticated", "exp": int(time.time()) + 3600},
        "wrong-secret",
        algorithm="HS256",
    )

    response = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {bad_token}"}
    )

    assert response.status_code == 401


def test_me_accepts_valid_token(client: TestClient) -> None:
    token = make_token()

    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "00000000-0000-0000-0000-000000000000"
    assert body["role"] == "authenticated"
