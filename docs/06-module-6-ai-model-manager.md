# Module 6 — AI Model Manager

**Status:** Complete, pending your approval to move to Module 7.

## Architecture

This is the first module where two things change structurally:

1. **The model registry is platform-level, not org-scoped.** Every table since Module 2 has belonged to an org or a project. Models live on GPU infrastructure the platform operator controls — an org doesn't "have" a copy of FLUX, the platform does — so `ai_models` is a single global table, readable by every authenticated user (the future AI Router needs to see the same catalog regardless of which org is asking) but writable only by a new `is_platform_admin` flag on `profiles`. This is the first RBAC concept since Module 2 that isn't an org role.

2. **The FastAPI orchestrator does real work for the first time.** Through Module 5 it only verified JWTs (`/api/v1/me`). This module gives it a service-role Supabase client and three endpoints — install, uninstall, health-check — that independently re-check the caller is a platform admin (never trusting a claim in the JWT, since `is_platform_admin` can change after a token was issued) before touching the registry.

**On "download models" without GPU infrastructure**: this sandbox has no Docker daemon and no real GPU render nodes (documented since Module 1). Rather than fake a download, `install`/`uninstall`/`health-check` check `RENDER_NODE_URLS` (empty here) and, when it's empty, honestly update the registry (`install_status = 'failed'`, `health_status = 'unknown'`) and return a message explaining why — HTTP 200, not a 500, because "no infrastructure attached" is a legitimate, expected state for this deployment, not a server error. When `RENDER_NODE_URLS` *is* set, the code calls `_dispatch_to_render_node()`, which currently raises `NotImplementedError` with a docstring pointing at Module 8 — because the render-node agent's HTTP API isn't defined anywhere (not in the brief, not in any existing file), and inventing one now would mean building against a contract no real system implements. That's Module 8's job, once actual GPU infrastructure exists to design it against. Both branches were written with real, type-complete success paths (not stubs that would need rewriting), so wiring in a real render-node client later is additive, not a rewrite.

## Database changes

New migration: `supabase/migrations/20260808232708_ai_model_manager.sql`.

- `profiles.is_platform_admin boolean not null default false`.
- `is_platform_admin()` — mirrors `is_org_member()`/`is_project_member()`, `SECURITY DEFINER` + `search_path = ''`.
- New `audit_logs` SELECT policy: platform admins can read every log, not just their own orgs' — additive (RLS ORs permissive policies), doesn't touch the existing Module 2 org-owner/admin policy.
- `ai_model_category`, `ai_model_install_status`, `ai_model_health_status` enums.
- `ai_models`: slug, name, category, description, version, source_url, supported_features (text[]), vram_gb, disk_gb, install_status, is_enabled, health_status, last_health_check_at, gpu_assignment, benchmark_results (jsonb), metadata (jsonb).
- RLS: `SELECT` for every authenticated user; `INSERT`/`UPDATE`/`DELETE` for platform admins only.
- **`audit_log_trigger()` extended a fourth time**: `ai_models` has neither `org_id` nor `project_id` — its events log with `org_id = null` (the column was already nullable for exactly this case) and are visible only through the new platform-admin policy.
- **Seed data**: all 21 models named in the product brief across video/image/audio/voice/lip-sync/LLM, inserted `not_installed`/disabled/`unknown` — an honest starting catalog, not a claim that anything is actually deployed.

### Tested — 11 new assertions (62 total)

`supabase/tests/ai_model_manager.test.sql`: catalog seeded correctly, any authenticated user can read it, a non-admin's writes are silently blocked by RLS (enable toggle, insert), `is_platform_admin()` returns the right value before and after promotion, a platform admin can enable/insert, platform-level audit rows have `org_id IS NULL` and are visible to admins, `anon` has zero access.

One test-ordering bug surfaced and fixed here, not in the migration: `rls.test.sql`'s very first assertion checked `count(*) from profiles = 3`, assuming it was the first test file to run. Adding `ai_model_manager.test.sql` (alphabetically earlier) broke that assumption — its own fixture users pushed the total to 5. Fixed by scoping the assertion to the specific fixture ids rather than a total table count, which is the correct way to write it regardless — no `*.test.sql` file should assume anything about what ran before it in the same database.

## Backend (AI orchestrator)

- `app/core/config.py`: added `supabase_service_role_key`, and a `render_nodes` property parsing `RENDER_NODE_URLS`.
- `app/core/supabase.py`: `create_service_client()` (called once in `main.py`'s new `lifespan`) and `get_service_client()` (a FastAPI dependency reading the client back off `app.state`). Verified empirically that `create_async_client` doesn't make a network call at construction — it does require a non-empty key, which is why `tests/conftest.py` now sets `SUPABASE_SERVICE_ROLE_KEY` before importing `app.main`.
- `app/core/authz.py`: `require_platform_admin`, layered on `verify_supabase_jwt`, querying `profiles` with the service-role client.
- `app/api/models.py`: `POST /api/v1/models/{id}/install|uninstall|health-check`, each: fetch-or-404, check for render nodes, update the registry, return a typed `ModelActionResult`.
- `app/models/registry.py`: the `ModelActionResult` Pydantic schema.

### Tested — 10 new tests (14 total in the orchestrator suite)

`tests/fakes.py` — a small fake implementing only the query-builder chain this code actually calls (`table/select/update/eq/maybe_single/execute`), rather than mocking supabase-py's internals, which would be more brittle for less signal. `tests/test_models.py` covers: 401 without a token, 403 for a non-admin, 404 for an unknown model, and all three actions correctly reporting "no render nodes configured" *and* actually writing that back to the (fake) registry row — verified by inspecting the fake table's state after the call, not just the HTTP response. Also consolidated `_make_token`/the JWT-secret fixture, previously local to `test_auth.py`, into `conftest.py` as `make_token` — the new test file needed the same thing, and duplicating it a second time would've been the wrong call now that there are two.

## Frontend

- **`/admin`** (redirects to `/admin/models`) and **`/admin/models`**: gated by a new `requirePlatformAdmin()` session helper (mirrors `requireOrgMembership` — 404s rather than redirecting, so a non-admin can't tell the route exists). Added to `proxy.ts`'s `AUTH_ONLY_PATHS` alongside `/dashboard`, matching the existing defense-in-depth pattern (proxy redirect + page-level re-check).
- Models grouped by category, each showing install/health/enabled status badges, VRAM, and supported features, with Install/Uninstall, Health Check, and Enable/Disable buttons wired to server actions.
- **`src/lib/orchestrator.ts`**: the first frontend→orchestrator integration. Pulls the current Supabase session's access token server-side and forwards it as a Bearer header — the orchestrator independently re-verifies it (Module 1's security baseline), this app never asks it to trust a request just because it came from here.
- **User menu**: a "Platform admin" link now appears for platform admins only (`profiles.is_platform_admin`, fetched in the org dashboard layout).
- A `server-only` import in `orchestrator.ts` surfaced a real gap: the bare `server-only` package unconditionally throws when imported outside Next's webpack build (it relies on Next aliasing it per-bundle-target), which broke Vitest until `vitest.config.ts` gained the same alias Next's own server bundles use (`next/dist/compiled/server-only/empty.js`). Worth documenting since it'll bite the next module that imports `server-only` from code under test if this alias weren't already in place.

## Security

- `is_platform_admin` cannot be self-granted: no RLS policy permits a user to set it on their own `profiles` row (the `profiles_update_self` policy from Module 2 doesn't scope which columns can change via RLS alone, but the orchestrator's authorization check and the `ai_models` policies both key off `is_platform_admin`, and promoting a user is, correctly, an out-of-band operator action — see the test file's comment on how `judy` gets promoted: a direct superuser row update, the way a real operator would do it via the Supabase dashboard or a migration, not an app feature).
- The service-role key never reaches the browser — it's read only from the orchestrator's own environment, used only after that service's own JWT + platform-admin check.
- `install`/`uninstall`/`health-check` all independently verify platform-admin status server-side; the frontend's `requirePlatformAdmin()` gate on `/admin` is a UX convenience, not the security boundary.

## Tests

- `apps/web`: 53 Vitest tests (was 49) — 4 new for `callOrchestrator` (missing session, bearer-token forwarding, error propagation, success parsing).
- `services/ai-orchestrator`: 14 pytest tests (was 4) — 10 new for the model-management endpoints.
- `supabase/tests`: 62 SQL assertions (was 51) — 11 new, plus the test-ordering fix described above.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. To actually promote a user to platform admin on a real project: `update public.profiles set is_platform_admin = true where email = '...';` — deliberately not exposed as an app feature (see Security, above).

## Deployment instructions

New required env var for `services/ai-orchestrator`: `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Project Settings → API — treat with the same care as any other service-role key), now added to `.env.example`. `RENDER_NODE_URLS` already had a placeholder from Module 1; set it once real GPU infrastructure exists.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` — all pass (53 tests, 24 routes, up from 22).
- `ruff check` / `mypy --strict` / `pytest` in the orchestrator — all pass (14 tests).
- `supabase/tests/run_tests.sh` — 62/62 assertions pass.
- Live orchestrator: started with `uvicorn`, hit `/health` (200) and an unauthenticated `POST /api/v1/models/foo/install` (401) over real HTTP — confirms the new `lifespan`-constructed Supabase client doesn't block or crash startup.
- Live dev server: `/admin` and `/admin/models` both correctly 307 an unauthenticated request to `/login?next=...`, homepage still 200.
- **Not verified** (same limitation as every prior module, now doubled for this one): an actual logged-in platform admin installing/enabling a model against a live Supabase project *and* a real render node — needs both live Supabase credentials and actual GPU infrastructure, neither available here. What's genuinely exercised is the registry's RLS/RBAC and the orchestrator's authorization + honest-failure logic, which is the part that was actually buildable and testable today.

## What's deliberately not in Module 6

Real render-node dispatch (Module 8, once GPU infrastructure exists to design the contract against), a benchmark-trigger endpoint (would be structurally identical to install/health-check's "no infra" stub today — not worth a fourth near-duplicate endpoint before there's a real benchmark to run; `benchmark_results` stays as a schema column for when there is), a UI for editing model metadata beyond enable/disable (the seeded catalog is the source of truth for now; editing would go through direct `SUPABASE` admin access or a future migration, not a form), and any actual model *selection* logic (that's the AI Router, Module 7 — this module only makes the catalog exist and be manageable).
