# Module 17 — Modal GPU Compute Provider

**Status:** Complete. An architecture update to the render pipeline, not a new user-facing studio — the original 16-module roadmap is otherwise unchanged.

## Architecture

The original brief assumed GPU compute would come from a dedicated Ubuntu server behind Nginx (see `docs/00-technical-audit-and-roadmap.md`, Sections 3/5). That assumption is replaced here with [Modal](https://modal.com) serverless GPU compute, behind a provider-agnostic abstraction so a future provider — a dedicated server included — never requires touching `app/api/render_jobs.py`:

```
Vercel → Next.js → Supabase → AI Orchestrator → Modal → ComfyUI → AI Models → Generated Video → Supabase Storage
```

- **`AIComputeProvider`** (`services/ai-orchestrator/app/core/compute/base.py`): the one interface every GPU backend implements — `submit`, `get_status`, `cancel`. `ModalComputeProvider` is the only implementation today; a `get_compute_provider()` factory (`app/core/compute/factory.py`) is the single place a second provider (RunPod, AWS, Lambda, Vast.ai, or the originally-planned dedicated server) would be wired in, gated by a new `AI_COMPUTE_PROVIDER` value — per your instruction, none of those are implemented now.
- **`ModalComputeProvider`** (`app/core/compute/modal_provider.py`) submits a compiled ComfyUI prompt to a Modal Function by name (`xdrama-comfyui-worker/generate`) via `Function.from_name(...).spawn.aio(...)`, storing the returned `FunctionCall` id as `render_jobs.provider_job_id`. A real, verified-in-this-dev-environment finding shaped the implementation: `modal.Client.from_credentials()` performs real network I/O and does not fail fast when Modal's API is unreachable — it hangs. Every Modal SDK call in this module is therefore wrapped in `asyncio.wait_for(..., timeout=15)`, converting an unreachable-network hang into a clean, honest `ComputeProviderError` instead of a stuck request.
- **`services/modal-worker/comfyui_app.py`** is the ComfyUI worker itself — the "internal AI workflow engine" that has always been documented to never be exposed to end users (Section 3). It runs as a Modal App with a GPU-attached `generate` function, a persistent `xdrama-model-weights` Modal Volume for model weights, and a `xdrama-supabase` Modal Secret carrying `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. **It, not the orchestrator, writes the job's stage progress directly to `render_jobs`** as it moves through the pipeline — the orchestrator's role is to spawn the job and record a handle, not poll it, which matches how Modal's `spawn()`/`FunctionCall` model actually works (fire-and-forget with an id you can look up later).
- **Two-tier honest failure**, the same shape Modules 8/13/14 established: (1) `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` unset → "Modal is not configured," checked before any Modal SDK call, so the common case never pays the 15s timeout; (2) credentials set but Modal/the target function is unreachable (which is the real state of every environment this code has run in — no Modal app has ever actually been deployed) → the timeout-guarded `ComputeProviderError` from tier one above.
- **A pre-existing, deliberately unresolved gap this module does not paper over**: `app/workflows/comfyui_compiler.py`'s compiled `class_type` strings have been placeholders since Module 8, because no real ComfyUI custom-node package has ever been installed and introspected for any of the 8 tracked models. Wiring Modal up doesn't change that — even a perfectly-configured Modal deployment would still need `comfyui_app.py`'s `_run_comfyui()` implemented against real custom-node class names, which this module explicitly does not fabricate (see "What's deliberately not in Module 17" below).
- **Model Manager and Router already covered every requirement named in this update** — nothing needed to change there. All 8 named models (Wan 2.2, HunyuanVideo, SkyReels V2, CogVideoX, Open-Sora, LTX Video, FLUX, SDXL) were seeded in Module 6. All 7 named routing criteria map onto Module 7's existing `routing_rules` task types: text-to-video/cinematic generation → `movie`, image-to-video → `image_to_video`, character consistency → `character_consistency`, human performance → `human_acting`, fast preview → `fast_draft`, long-form generation → `long_story`. ("Cinematic generation" isn't a separate task type — `movie`'s existing description, "General movie/scene generation," already covers it; adding a synonym rule would just duplicate `movie` rather than add real routing behavior.)
- **Module 6's `app/api/models.py` install/health-check flow is explicitly not migrated onto this abstraction.** It has its own, older `render_node_urls`-based honest-failure pattern for a different concern (installing model weights onto a node) that predates this module. Migrating it onto Modal Volumes is a reasonable follow-up but a separate scope decision, not bundled in here — see "What's deliberately not in Module 17."

## Database changes

New migration: `supabase/migrations/20260830135333_modal_gpu_compute_provider.sql`. No existing table's behavior changes; every RLS policy from Modules 8 and 6 is untouched.

- **`render_job_stage` enum** (new): `starting | downloading_models | generating | post_processing | uploading`.
- **`render_jobs` gains**: `stage` (nullable, only meaningful while `status = 'running'`), `compute_provider` (`text not null default 'modal'` — which `AIComputeProvider` ran the job), `provider_job_id` (nullable — the provider's own handle, e.g. a Modal `FunctionCall` id).
- **`ai_models` gains**: `compute_function_name` (nullable — the Modal Function name that serves a given model; null until an operator actually wires one up, honestly reflecting that none exist yet).
- The coarse `render_job_status` enum from Module 8 is deliberately left alone — no reason to touch the dispatch-honesty tests that already assert against `queued/running/completed/failed/cancelled`. `stage` is additive detail on top of `status = 'running'`, not a replacement for it.

### Tested — 9 new assertions (204 total)

`supabase/tests/modal_gpu_compute_provider.test.sql`: a new render job defaults to `compute_provider = 'modal'` with a null `stage`; a project member can set `stage`/`provider_job_id` on dispatch and advance `stage` through `downloading_models → generating → post_processing → uploading`; an unknown stage value is rejected by Postgres's enum type check; a seeded `ai_models` row has a null `compute_function_name` until wired up; a non-admin cannot set it (regression against Module 6's existing write policy); a platform admin can.

## Backend (AI orchestrator)

- **`app/core/compute/base.py`**: `ComputeJobSpec`, `ComputeJobHandle`, `ComputeProviderError`, and the abstract `AIComputeProvider`.
- **`app/core/compute/modal_provider.py`**: `ModalComputeProvider` — lazy, no-I/O construction (safe to inject via `Depends()` on every request) with every actual Modal SDK call timeout-guarded, as described above.
- **`app/core/compute/factory.py`**: `get_compute_provider()`, the sole extension point for future providers.
- **`app/core/config.py`**: `ai_compute_provider` (default `"modal"`), `modal_token_id`, `modal_token_secret`, and a `modal_configured` property.
- **`app/api/render_jobs.py`**: the dispatch endpoint now checks `settings.modal_configured` (replacing the old `settings.render_nodes` check) before the enqueue/dequeue round-trip, then calls `compute_provider.submit(...)` instead of the old hardcoded `NotImplementedError`, writing `status='running'`, `stage='starting'`, `compute_provider='modal'`, and `provider_job_id` on success.
- **`tests/fake_compute.py`** (new): `FakeComputeProvider`, the same test-double pattern as `tests/fakes.py`'s `FakeSupabaseClient` — lets dispatch tests exercise the real branching logic (not-configured / provider failure / success) without touching the network or the real `modal` package's client.
- **`modal>=1.5,<2`** added to `pyproject.toml`/`requirements.txt` — a real, installed dependency, not a stub.

## Frontend

- **`render-panel.tsx`**: the render-job list now shows `stage` (when present and `status='running'`) next to the status badge, e.g. "downloading models · running." No new page — this is the same panel Module 8 built, extended with one field.
- **`lib/supabase/types.ts`**: hand-updated with the three new `render_jobs` columns, the new `ai_models.compute_function_name` column, and the `render_job_stage` enum, matching the existing convention of hand-maintaining this file alongside migrations (see Module 6 onward) rather than requiring a live `supabase gen types` run against a linked project for every change.

## Security

No new privilege boundary. `render_jobs.stage`/`compute_provider`/`provider_job_id` are writable under the exact same RLS policy Module 8 already granted project members for `status` — the Modal worker itself writes them using the service-role key (bypassing RLS entirely, the same pattern every trusted server-side write in this project uses), not through any new client-facing permission. `ai_models.compute_function_name` sits under Module 6's existing platform-admin-only write policy; the 9 new SQL assertions confirm both of these directly rather than assuming they follow from unchanged policy definitions.

## Tests

- `supabase/tests`: **204 SQL assertions** (was 195) — 9 new in `modal_gpu_compute_provider.test.sql`.
- `services/ai-orchestrator`: **43 pytest tests** (was 38) — net +5: two pre-existing render-node tests replaced with three Modal-shaped ones (`modal not configured`, `provider call fails`, `dispatch succeeds` — a genuine new happy-path test this pipeline never had before, since the old code could never actually succeed). `ruff check` and `mypy --strict` both clean across 28 source files (up from 24, including the new `app/core/compute/` package).
- `apps/web`: **103 Vitest tests** (unchanged) — this module's frontend change was a display-only addition with no new validation logic to unit test.
- `services/modal-worker/comfyui_app.py`: verified with `python -m py_compile`, `ruff check`, and `mypy --strict` (all clean) — **not** deployed or run against a real Modal account; see below.

## Migration / setup instructions

1. `npx supabase db push` picks up the new migration.
2. `npx supabase gen types typescript --linked > apps/web/src/lib/supabase/types.ts` (or trust the hand-applied update in this commit — both now agree).
3. Get Modal credentials: `pip install modal && modal setup` (or copy `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` from modal.com → Settings → API Tokens).
4. `modal secret create xdrama-supabase SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`
5. `modal deploy services/modal-worker/comfyui_app.py`
6. Set `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` on the AI orchestrator (`services/ai-orchestrator/.env`, or its real deployment's env vars).
7. `services/ai-orchestrator/requirements.txt` and `requirements-dev.txt` (via `-r requirements.txt`) now pull in `modal` — CI's existing `pip install -r requirements-dev.txt` step picks it up with no workflow changes needed.

Until steps 3–6 are done anywhere, render dispatch reports "Modal is not configured" — the same honest, non-blocking failure mode this pipeline has had since Module 8, just naming the real target infrastructure instead of a placeholder.

## Verification performed this session

- `ruff check .` / `mypy app` / `pytest -q` in the orchestrator — all pass (43 tests, including two new tests that exercise `FakeComputeProvider` through a real HTTP round-trip via `TestClient`, and a Redis-backed queue round-trip via a locally started `redis-server`).
- `python -m py_compile`, `ruff check`, and `mypy --strict` against `services/modal-worker/comfyui_app.py` — all clean.
- A real, direct experiment against the installed `modal` package (`modal.Client.from_credentials("", "")` in this dev environment) confirmed the hang-not-fail-fast behavior described above — this is the actual reason every Modal call in `modal_provider.py` is timeout-guarded, not a hypothetical precaution.
- `supabase/tests/run_tests.sh` against a local Postgres — **204/204 assertions passed**, confirmed via targeted grep that all 9 new assertions individually passed.
- `pnpm lint` / `pnpm typecheck` / `pnpm test` (103 tests) / `pnpm build` in `apps/web` — all pass.
- **Not verified, and not verifiable from this environment**: an actual Modal deployment, a real GPU job, real model weights downloading into a Modal Volume, or real ComfyUI execution. No Modal account exists in this session, and even with one, `comfyui_app.py`'s core generation step is an explicit `NotImplementedError` pending real ComfyUI custom-node installation work — see below.

## What's deliberately not in Module 17

Real ComfyUI execution (`_run_comfyui`), model-weight downloading into the Modal Volume (`_ensure_models_present`), post-processing (`_post_process`), and Supabase Storage upload (`_upload_to_supabase_storage`) are all explicit `NotImplementedError`s in `comfyui_app.py` — none of the 8 tracked models has a real, installed, introspected ComfyUI custom-node package behind it anywhere in this project's history, so there is no real `class_type` name or model-weights URL to wire up honestly. This is the same "real infrastructure follow-up, not buildable today" gap Module 8 already documented for the render-node dispatch step; Modal replaces *where* that gap lives, not the gap itself. Also not in scope: migrating Module 6's `app/api/models.py` install/health-check flow onto Modal Volumes (a reasonable future step, kept separate rather than bundled); a `get_status`/`cancel` HTTP endpoint on the orchestrator (the interface exists on `AIComputeProvider` for completeness and future use, but nothing calls `get_status`/`cancel` today — cancellation already works today by setting `render_jobs.status = 'cancelled'` directly, per Module 8's RLS); and, per your explicit instruction, any second `AIComputeProvider` implementation (RunPod, AWS, Lambda, Vast.ai, or a dedicated GPU server) — the abstraction exists specifically so adding one later never requires revisiting `app/api/render_jobs.py`.
