import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.supabase import get_user_scoped_client
from app.main import app
from tests.conftest import make_token
from tests.fakes import FakeSupabaseClient

JOB_ID = "11111111-1111-1111-1111-111111111111"
WORKFLOW_ID = "22222222-2222-2222-2222-222222222222"

VALID_GRAPH = {
    "nodes": [
        {"id": "a", "type": "input", "config": {"key": "script"}},
        {"id": "b", "type": "model_task", "config": {"taskType": "movie", "params": {}}},
        {"id": "c", "type": "output", "config": {"key": "video"}},
    ],
    "edges": [
        {"id": "e1", "source": "a", "target": "b"},
        {"id": "e2", "source": "b", "target": "c"},
    ],
}


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    fake = FakeSupabaseClient()
    fake.table("render_jobs").rows[JOB_ID] = {
        "id": JOB_ID,
        "status": "queued",
        "workflow_id": WORKFLOW_ID,
    }
    fake.table("workflows").rows[WORKFLOW_ID] = {"graph": VALID_GRAPH}
    return fake


@pytest.fixture(autouse=True)
def _override_supabase(fake_supabase: FakeSupabaseClient):
    app.dependency_overrides[get_user_scoped_client] = lambda: fake_supabase
    yield
    app.dependency_overrides.pop(get_user_scoped_client, None)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_dispatch_requires_bearer_token(client: TestClient) -> None:
    app.dependency_overrides.pop(get_user_scoped_client, None)  # test the real auth chain

    response = client.post(f"/api/v1/render-jobs/{JOB_ID}/dispatch")

    assert response.status_code == 401


def test_dispatch_404s_for_unknown_job(client: TestClient) -> None:
    token = make_token()

    response = client.post(
        "/api/v1/render-jobs/does-not-exist/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_dispatch_409s_for_a_job_that_is_not_queued(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("render_jobs").rows[JOB_ID]["status"] = "running"
    token = make_token()

    response = client.post(
        f"/api/v1/render-jobs/{JOB_ID}/dispatch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 409


def test_dispatch_404s_for_unknown_workflow(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("render_jobs").rows[JOB_ID]["workflow_id"] = "does-not-exist"
    token = make_token()

    response = client.post(
        f"/api/v1/render-jobs/{JOB_ID}/dispatch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404


def test_dispatch_fails_honestly_on_an_invalid_graph(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("workflows").rows[WORKFLOW_ID]["graph"] = {
        "nodes": [],
        "edges": "not-a-list",
    }
    token = make_token()

    response = client.post(
        f"/api/v1/render-jobs/{JOB_ID}/dispatch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "invalid workflow graph" in body["message"].lower()
    assert fake_supabase.table("render_jobs").rows[JOB_ID]["status"] == "failed"


def test_dispatch_fails_honestly_with_no_render_nodes_configured(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    token = make_token()

    response = client.post(
        f"/api/v1/render-jobs/{JOB_ID}/dispatch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "no render nodes" in body["message"].lower()
    assert fake_supabase.table("render_jobs").rows[JOB_ID]["status"] == "failed"


def test_dispatch_with_a_render_node_configured_still_fails_honestly(
    client: TestClient,
    fake_supabase: FakeSupabaseClient,
    monkeypatch: pytest.MonkeyPatch,
    redis_available: None,
) -> None:
    """With RENDER_NODE_URLS set, dispatch goes further — through the real
    enqueue/dequeue round-trip — before hitting the (also honest, still
    real) NotImplementedError for actually submitting to a render node.
    Exercises the queue integration this module's other tests (test_queue.py)
    only exercise in isolation."""
    monkeypatch.setenv("RENDER_NODE_URLS", "http://fake-render-node.internal")
    # The `client` fixture's TestClient(app) already triggered the app's
    # lifespan (which reads settings), warming the lru_cache before this
    # line runs — clear it again now that the env var above is set, so
    # the endpoint's own Depends(get_settings) call picks it up.
    get_settings.cache_clear()
    token = make_token()

    response = client.post(
        f"/api/v1/render-jobs/{JOB_ID}/dispatch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "not implemented" in body["message"].lower()
    assert fake_supabase.table("render_jobs").rows[JOB_ID]["status"] == "failed"
