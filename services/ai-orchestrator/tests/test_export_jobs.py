import pytest
from fastapi.testclient import TestClient

from app.core.supabase import get_user_scoped_client
from app.main import app
from tests.conftest import make_token
from tests.fakes import FakeSupabaseClient

EXPORT_JOB_ID = "55555555-5555-5555-5555-555555555555"
TIMELINE_ID = "66666666-6666-6666-6666-666666666666"
CLIP_ID = "77777777-7777-7777-7777-777777777777"
RENDER_JOB_ID = "88888888-8888-8888-8888-888888888888"


@pytest.fixture
def fake_supabase() -> FakeSupabaseClient:
    fake = FakeSupabaseClient()
    fake.table("export_jobs").rows[EXPORT_JOB_ID] = {
        "id": EXPORT_JOB_ID,
        "status": "queued",
        "timeline_id": TIMELINE_ID,
    }
    return fake


@pytest.fixture(autouse=True)
def _override_supabase(fake_supabase: FakeSupabaseClient):
    app.dependency_overrides[get_user_scoped_client] = lambda: fake_supabase
    yield
    app.dependency_overrides.pop(get_user_scoped_client, None)


def test_dispatch_requires_bearer_token(client: TestClient) -> None:
    app.dependency_overrides.pop(get_user_scoped_client, None)  # test the real auth chain

    response = client.post(f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch")

    assert response.status_code == 401


def test_dispatch_404s_for_unknown_export_job(client: TestClient) -> None:
    token = make_token()

    response = client.post(
        "/api/v1/export-jobs/does-not-exist/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_dispatch_409s_for_an_export_job_that_is_not_queued(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("export_jobs").rows[EXPORT_JOB_ID]["status"] = "completed"
    token = make_token()

    response = client.post(
        f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409


def test_dispatch_fails_honestly_with_no_clips_at_all(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """No timeline_clips rows exist for this timeline — the real state
    for a freshly-created movie timeline."""
    token = make_token()

    response = client.post(
        f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "no rendered clips" in body["message"].lower()
    assert fake_supabase.table("export_jobs").rows[EXPORT_JOB_ID]["status"] == "failed"


def test_dispatch_fails_honestly_when_no_clip_has_a_source_render(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    fake_supabase.table("timeline_clips").rows[CLIP_ID] = {
        "id": CLIP_ID,
        "timeline_id": TIMELINE_ID,
        "source_render_job_id": None,
    }
    token = make_token()

    response = client.post(
        f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "no rendered clips" in body["message"].lower()


def test_dispatch_fails_honestly_when_the_source_render_has_not_completed(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """This is the real state today: a clip *does* reference a render
    job (Module 11's source_render_job_id), but nothing has ever
    completed rendering, since no GPU infrastructure exists."""
    fake_supabase.table("timeline_clips").rows[CLIP_ID] = {
        "id": CLIP_ID,
        "timeline_id": TIMELINE_ID,
        "source_render_job_id": RENDER_JOB_ID,
    }
    fake_supabase.table("render_jobs").rows[RENDER_JOB_ID] = {
        "id": RENDER_JOB_ID,
        "status": "failed",
        "output_asset_url": None,
    }
    token = make_token()

    response = client.post(
        f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "none has completed" in body["message"].lower()
    assert fake_supabase.table("export_jobs").rows[EXPORT_JOB_ID]["status"] == "failed"


def test_dispatch_still_fails_honestly_with_a_completed_render(
    client: TestClient, fake_supabase: FakeSupabaseClient
) -> None:
    """Even with a real completed render job attached (hypothetically —
    none exists in this deployment), there is still no media-processing
    service to composite the final export."""
    fake_supabase.table("timeline_clips").rows[CLIP_ID] = {
        "id": CLIP_ID,
        "timeline_id": TIMELINE_ID,
        "source_render_job_id": RENDER_JOB_ID,
    }
    fake_supabase.table("render_jobs").rows[RENDER_JOB_ID] = {
        "id": RENDER_JOB_ID,
        "status": "completed",
        "output_asset_url": "https://example.com/rendered-clip.mp4",
    }
    token = make_token()

    response = client.post(
        f"/api/v1/export-jobs/{EXPORT_JOB_ID}/dispatch",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert "not implemented" in body["message"].lower()
    assert fake_supabase.table("export_jobs").rows[EXPORT_JOB_ID]["status"] == "failed"
