import pytest
from fastapi.testclient import TestClient

from app.core.supabase import get_service_client
from app.main import app
from tests.conftest import make_token
from tests.fakes import FakeSupabaseClient

ADMIN_ID = "00000000-0000-0000-0000-000000000001"
MEMBER_ID = "00000000-0000-0000-0000-000000000002"
MODEL_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    fake = FakeSupabaseClient()
    fake.table("profiles").rows[ADMIN_ID] = {"is_platform_admin": True}
    fake.table("profiles").rows[MEMBER_ID] = {"is_platform_admin": False}
    fake.table("ai_models").rows[MODEL_ID] = {
        "id": MODEL_ID,
        "slug": "flux",
        "install_status": "not_installed",
        "health_status": "unknown",
        "is_enabled": False,
    }
    return fake


@pytest.fixture(autouse=True)
def _override_supabase(fake_supabase: FakeSupabaseClient):
    app.dependency_overrides[get_service_client] = lambda: fake_supabase
    yield
    app.dependency_overrides.pop(get_service_client, None)


def test_install_requires_bearer_token(client: TestClient) -> None:
    response = client.post(f"/api/v1/models/{MODEL_ID}/install")

    assert response.status_code == 401


def test_install_rejects_non_admin(client: TestClient) -> None:
    token = make_token(sub=MEMBER_ID)

    response = client.post(
        f"/api/v1/models/{MODEL_ID}/install", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


def test_install_404s_for_unknown_model(client: TestClient) -> None:
    token = make_token(sub=ADMIN_ID)

    response = client.post(
        "/api/v1/models/does-not-exist/install", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404


def test_install_reports_no_render_nodes_honestly(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    token = make_token(sub=ADMIN_ID)

    response = client.post(
        f"/api/v1/models/{MODEL_ID}/install", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["install_status"] == "failed"
    assert "no render nodes" in body["message"].lower()

    # and the registry row was actually updated to reflect that
    assert fake_supabase.table("ai_models").rows[MODEL_ID]["install_status"] == "failed"


def test_uninstall_reports_no_render_nodes_honestly(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    token = make_token(sub=ADMIN_ID)

    response = client.post(
        f"/api/v1/models/{MODEL_ID}/uninstall", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["ok"] is False


def test_health_check_reports_no_render_nodes_honestly(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    token = make_token(sub=ADMIN_ID)

    response = client.post(
        f"/api/v1/models/{MODEL_ID}/health-check", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["health_status"] == "unknown"
    assert fake_supabase.table("ai_models").rows[MODEL_ID]["health_status"] == "unknown"
