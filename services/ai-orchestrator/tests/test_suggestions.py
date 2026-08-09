import pytest
from fastapi.testclient import TestClient

from app.core.supabase import get_user_scoped_client
from app.main import app
from tests.conftest import make_token
from tests.fakes import FakeSupabaseClient

SUGGESTION_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    fake = FakeSupabaseClient()
    fake.table("ai_suggestions").rows[SUGGESTION_ID] = {
        "id": SUGGESTION_ID,
        "role": "director",
        "prompt": "Script: INT. VAULT - NIGHT...",
        "status": "pending",
    }
    return fake


@pytest.fixture(autouse=True)
def _override_supabase(fake_supabase: FakeSupabaseClient):
    app.dependency_overrides[get_user_scoped_client] = lambda: fake_supabase
    yield
    app.dependency_overrides.pop(get_user_scoped_client, None)


def test_generate_requires_bearer_token(client: TestClient) -> None:
    app.dependency_overrides.pop(get_user_scoped_client, None)  # test the real auth chain

    response = client.post(f"/api/v1/suggestions/{SUGGESTION_ID}/generate")

    assert response.status_code == 401


def test_generate_404s_for_unknown_suggestion(client: TestClient) -> None:
    token = make_token()

    response = client.post(
        "/api/v1/suggestions/does-not-exist/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_generate_409s_for_a_suggestion_that_is_not_pending(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("ai_suggestions").rows[SUGGESTION_ID]["status"] = "completed"
    token = make_token()

    response = client.post(
        f"/api/v1/suggestions/{SUGGESTION_ID}/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409


def test_generate_fails_honestly_with_no_eligible_model_installed(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """Default fake RPC response (all-null composite) — the real state of
    this deployment, since no LLM model is installed anywhere."""
    token = make_token()

    response = client.post(
        f"/api/v1/suggestions/{SUGGESTION_ID}/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "no eligible model" in body["message"].lower()
    assert fake_supabase.table("ai_suggestions").rows[SUGGESTION_ID]["status"] == "failed"


def test_generate_uses_the_role_specific_task_type(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """A cinematographer request routes through cinematographer_suggestions,
    not a hardcoded task type."""
    fake_supabase.table("ai_suggestions").rows[SUGGESTION_ID]["role"] = "cinematographer"
    captured: dict[str, object] = {}

    original_rpc = fake_supabase.rpc

    def spy_rpc(fn_name: str, params: dict[str, object]):
        captured["fn_name"] = fn_name
        captured["params"] = params
        return original_rpc(fn_name, params)

    fake_supabase.rpc = spy_rpc  # type: ignore[method-assign]
    token = make_token()

    client.post(
        f"/api/v1/suggestions/{SUGGESTION_ID}/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert captured["fn_name"] == "select_model_for_task"
    assert captured["params"] == {"p_task_type": "cinematographer_suggestions"}


def test_generate_still_fails_honestly_when_a_model_is_eligible(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """Even if an admin marks a model installed+enabled (hypothetically,
    since none is in this deployment), there is still no real LLM
    inference backend wired up — the honest failure just moves one step
    later, from "nothing installed" to "nothing to call"."""
    fake_supabase.rpc_responses["select_model_for_task"] = {
        "id": "44444444-4444-4444-4444-444444444444",
        "slug": "qwen",
        "name": "Qwen",
    }
    token = make_token()

    response = client.post(
        f"/api/v1/suggestions/{SUGGESTION_ID}/generate",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "not implemented" in body["message"].lower()
    assert fake_supabase.table("ai_suggestions").rows[SUGGESTION_ID]["status"] == "failed"
