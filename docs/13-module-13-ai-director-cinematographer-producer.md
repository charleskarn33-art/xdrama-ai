# Module 13 — AI Director / Cinematographer / Producer

**Status:** Complete, pending your approval to move to Module 14.

## Architecture

"Higher-level suggestion layers on top of the working pipeline — most valuable once there's a pipeline to advise on." By Module 12 there is one: Story Bible, Script Studio, Scenes/Shots, Movie Composer. This module adds a place to request LLM-generated advice from three roles (Director, Cinematographer, Producer) against that real project state.

**The one architectural decision worth explaining**: LLM suggestions route through the exact same Model Manager + Router every other generation feature uses — `ai_suggestions` → three new `llm`-category routing_rules task types (`director_suggestions`, `cinematographer_suggestions`, `producer_suggestions`) → `select_model_for_task()` picking among the `qwen`/`llama`/`deepseek` models Module 6 already registered. It does **not** call a hosted LLM API (Anthropic, OpenAI, etc.). The product brief's architecture governs models installed on the platform operator's own GPU infrastructure; a hosted-API integration is a different architecture the brief never specifies, and nothing in this project has ever configured API keys or a client for one. Bolting one on now — however tempting, since it's genuinely the easiest way to make "AI suggestions" actually produce text — would be exactly the kind of unverifiable, out-of-scope integration this project has avoided since Module 6's honesty rules were established. So: with nothing installed (this deployment's real state), a suggestion request honestly fails the same way every image/audio/video generation request has since Module 8, at whichever of the two points the gap actually is:

1. No LLM model installed/enabled → `select_model_for_task()` returns an all-null row → honest fail, "No eligible model installed."
2. A model *is* installed and enabled (hypothetically, since none is in this deployment) → the orchestrator's `_generate_llm_suggestions()` raises `NotImplementedError` → honest fail, "LLM inference is not implemented yet" — there is still no real local inference server wired up to actually call the model.

Both are tested (`test_generate_fails_honestly_with_no_eligible_model_installed`, `test_generate_still_fails_honestly_when_a_model_is_eligible`), the same two-tier honesty pattern Module 8's dispatch endpoint established for render jobs.

**The context sent to the (currently unreachable) LLM is real, not a placeholder.** `buildAdvisorPrompt()` pulls the project's actual name/description, character list, scene list, and most-recently-updated script content, and frames it with a role-specific instruction. If a real inference backend is wired up later, the prompt-assembly half of this feature needs no rework — only `_generate_llm_suggestions()`'s honest `NotImplementedError` needs to become a real call.

## Database changes

New migration: `supabase/migrations/20260809170303_ai_director_cinematographer_producer.sql`.

- **`ai_advisor_role` enum**: `director | cinematographer | producer`.
- **`ai_suggestion_status` enum**: `pending | running | completed | failed`.
- **`ai_suggestions`**: `project_id`, `role`, `prompt` (the assembled context sent to the LLM), `status`, `result` (jsonb, populated only on the unreachable success path), `error_message`, `created_by`, timestamps, `completed_at`.
- RLS: **select/insert/update only, no delete** — the same append-mostly-history shape as `render_jobs`, so an advisory request (and whatever the LLM said or didn't say) can't be erased, only added to.
- Seed: the three advisor routing_rules rows.
- `project_id` is a plain client-supplied column, so `audit_log_trigger()`'s existing generic branch already covers this table — no changes needed, the fifth module in a row (after 9, 10, 11, 12) where this held.

### Tested — 9 new assertions (165 total)

`supabase/tests/ai_director_cinematographer_producer.test.sql` (runs first alphabetically this time — the `ai_` prefix sorts before `ai_model_manager`, so this file couldn't assume any other test file's state either, the same standing rule from the other direction): the three advisor task types and their `llm` category; the router honestly returning all-null for `director_suggestions`; a suggestion request created defaulting to `pending` with its audit trail; an unknown role rejected by the enum; a plain project member (not the requester) able to update a request's status — the orchestrator acts through a user-scoped client on behalf of whoever calls it, not necessarily the original requester, so this grant has to work for any project member; `ai_suggestions` rejecting delete entirely (`insufficient_privilege`); cross-org isolation; `anon` blocked.

## Backend (AI orchestrator)

- **`app/core/db.py`** (new, extracted from `render_jobs.py`): `get_row_or_404()`, now shared by both `render_jobs.py` and the new `suggestions.py` rather than duplicated — a small, genuinely-justified refactor of existing code (moving an identical 7-line helper, not rewriting its logic) now that a second endpoint needs it.
- **`app/models/suggestion.py`**: `SuggestionResult` (`ok`/`status`/`message`), the same shape as `render_jobs`' `DispatchResult`.
- **`app/api/suggestions.py`**: `POST /v1/suggestions/{id}/generate` — fetches the suggestion via a user-scoped client (unknown/not-yours 404s naturally through RLS), rejects if status isn't `pending` (409), calls `select_model_for_task()` via RPC for the role's task type, and honestly fails at whichever of the two points above applies. Registered in `app/main.py` alongside the other routers.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/advisor`**: three cards (Director/Cinematographer/Producer), each listing that role's past requests (status badge, error message, or `result` JSON if one ever exists) with a "Request suggestions" button.
- **`requestSuggestions`** server action: builds the prompt via `buildAdvisorPrompt()`, inserts the `ai_suggestions` row, calls the orchestrator's `generate` endpoint, then re-fetches the row — the same "re-fetch after dispatch, since it can synchronously fail the row server-side" pattern Module 9's `generateReferenceArt` established.
- **Project tabs** gained an "AI Advisor" entry.
- `src/lib/validations/advisor.ts`: a small schema (`projectId`, `role`) — the prompt itself isn't user-supplied input, so it isn't part of the validated request shape.

## Security

Same layered RBAC as every module since Module 4: `is_project_member()`, full audit trail (the table fits the existing generic branch). The one new shape is `ai_suggestions`' delete-blocked RLS, matching `render_jobs`' precedent rather than introducing a new rule. No new privilege boundary: the orchestrator endpoint uses the same user-scoped-client pattern as render job dispatch, so its authorization *is* the RLS policy.

## Tests

- `supabase/tests`: **165 SQL assertions** (was 156) — 9 new in `ai_director_cinematographer_producer.test.sql`.
- `services/ai-orchestrator`: **35 pytest tests** (was 29) — 6 new in `test_suggestions.py`, covering auth, 404, 409, both honest-failure tiers, and that the role-specific task type (not a hardcoded one) is actually what gets passed to `select_model_for_task`. `ruff check` and `mypy --strict` both clean across 22 source files (up from 19).
- `apps/web`: **94 Vitest tests** (was 92) — 2 new covering the advisor role schema.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. No new environment variables, no change to the deployment shape — the orchestrator's existing Supabase JWT/anon-key configuration is all this endpoint needs.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (94 tests, 44 routes including the new `/advisor` route).
- `ruff check` / `mypy --strict` / `pytest -q` in the orchestrator — all pass (35 tests), plus a live smoke test: `uvicorn app.main:app`, `GET /health` → 200, unauthenticated `POST /api/v1/suggestions/foo/generate` → 401.
- `supabase/tests/run_tests.sh` — 165/165 assertions pass.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../advisor` correctly 307s an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual LLM-generated suggestion — no local inference backend or hosted LLM API is wired up in this deployment, and this module's job was to build the request/context/routing pipeline up to that honest boundary, not fabricate what's beyond it.

## What's deliberately not in Module 13

A hosted LLM API integration (explicitly out of scope — see the architecture section above); streaming/incremental suggestion display (results, if they ever exist, land as one completed `result` blob, not a token stream — there's no real inference to stream from yet anyway); suggestion history pruning/archival UI (append-only by design, matching `render_jobs`); and, as with every module since Module 6, any of this actually calling a real LLM.
