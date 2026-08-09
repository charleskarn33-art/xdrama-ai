# Module 7 — AI Router

**Status:** Complete, pending your approval to move to Module 8.

## Architecture

"Users never choose models unless they enable Advanced Mode. The router automatically selects the best model." — implemented as data, not code: a `routing_rules` table (`task_type` → an ordered fallback chain of model slugs) plus one Postgres function, `select_model_for_task()`, rather than a hardcoded if/else chain in the orchestrator. Same reasoning as Module 6 making `ai_models` a table instead of a hardcoded model list: a platform admin should be able to retune which model handles "fast draft" without a code deploy.

**Why this lives in Postgres, not the orchestrator**: the router is fundamentally a read-only ranked lookup over two tables (`routing_rules`, `ai_models`) that are already `SELECT`-open to every authenticated user via RLS. There's no privileged operation here (unlike Module 6's install/health-check, which needed the orchestrator's service-role client to write past a caller's own grants) — so `select_model_for_task()` runs with plain invoker rights, callable directly from the frontend via `supabase.rpc(...)`, and gets the same real-Postgres test treatment every other module's business logic has had, rather than being reimplemented in Python where it'd need its own test harness.

**Seeded with exactly the six task types the brief names** (Movie, Character Consistency, Human Acting, Image to Video, Long Story, Fast Draft — all video-category, matching the brief's routing examples exactly: `movie → wan-2-2`, `character_consistency → skyreels-v2`, etc.). Task types for other categories (image/audio/voice/llm) get added the same way, by whichever future Studio module actually needs them — not speculatively here.

## Database changes

New migration: `supabase/migrations/20260809090133_ai_router.sql`.

- `routing_rules`: `task_type` (unique, snake_case), `category`, `description`, `preferred_model_slugs` (`text[]`, an ordered fallback chain).
- **Referential integrity for the slug array**: Postgres has no array foreign key, so a `BEFORE INSERT/UPDATE` trigger (`validate_routing_rule_slugs`) checks every slug exists in `ai_models` — the same approach as Module 4's cross-project relationship guard.
- RLS: identical shape to `ai_models` — every authenticated user reads, only platform admins write.
- **`audit_log_trigger()` extended a fifth time**: `routing_rules` joins `ai_models` as the second platform-level (`org_id`-null) table.
- **`select_model_for_task(p_task_type, p_override_slug default null)`**: Advanced Mode override (validates the requested model is actually installed+enabled — override lets a user pick *which* eligible model, not bypass eligibility) → walk the task type's preferred chain, first installed+enabled model wins → fall back to any installed+enabled model in the same category, ordered by `(created_at, slug)`. Returns an `ai_models` row where every column is `null` when nothing is eligible (Postgres composite-null semantics for a no-match `SELECT INTO`) — callers check `(result).id is null`, not `result is null`; documented in the function's comment since it's an easy contract to get wrong.
- Seed: the six rules above.

### Tested — 13 new assertions (75 total), and two real bugs caught

`supabase/tests/ai_router.test.sql`. This module's tests caught two genuine issues, not just confirmed the happy path:

1. **Cross-file state leakage.** All `*.test.sql` files share one database within a `run_tests.sh` run. An early version of this test asserted an Advanced Mode override against `flux` as "a model that's not installed" — but `ai_model_manager.test.sql` (which runs first, alphabetically) had already installed and enabled `flux` as part of *its own* test. Fixed by having this test explicitly reset the specific row's state before asserting on it (`update ai_models set is_enabled = false, install_status = 'not_installed' where slug = 'sdxl'`) rather than assuming any model's state — the second time this exact class of bug has appeared (the first was Module 6's fix to `rls.test.sql`'s profile-count assertion), so `supabase/tests/README.md` is worth treating this as the standing rule: never assume another test file's fixtures, always establish the state a test needs itself.
2. **Non-deterministic tiebreaking.** The category-fallback query originally ordered by `created_at` alone. The seed migration inserts all 21 models in one `INSERT` statement, and Postgres evaluates `now()` once per statement — every seeded row shares the *exact same* `created_at`. The test caught this directly (expected one slug, got a different one, both equally "correct" under the original ordering). Fixed by adding `slug` as an explicit secondary sort key in the migration itself, making the tie-break deterministic rather than dependent on incidental row-storage order.

Full coverage: seed count and readability, "nothing installed → all-null row" for both a known and unknown task type, the router actually walking the fallback chain (installing the *second* preferred model first, confirming it's picked over an uninstalled first choice, then confirming the first choice wins once it's also installed), category fallback with deterministic tiebreaking, Advanced Mode override (both the eligible-model and not-installed cases), the slug-validation trigger rejecting an unknown model, a valid rule insert, RLS blocking non-admin writes, and `anon` having zero access.

## Frontend

- **`/admin/routing`**: lists every rule with its category and fallback chain, and a live "Currently selects" column that actually calls `select_model_for_task()` via `supabase.rpc()` for each rule — not a static readout of the `preferred_model_slugs` column. With nothing installed on real infrastructure, this honestly shows "no eligible model installed" for every rule, which is the correct, verifiable behavior for this deployment's actual state.
- **`AdminNav`**: a small tab bar (Models / Router) added to `/admin`'s layout now that there are two admin sections.
- No rule-editing UI (create/reorder chains) — the database layer fully supports it (tested), but a polished array-reordering editor is deferred the same way Module 6 deferred a model-metadata editor: not worth building before there's a concrete need, and direct Supabase/SQL access covers it in the meantime.

## Backend (AI orchestrator)

No changes. `select_model_for_task()` is called directly via Supabase RPC (from the frontend today, from the orchestrator once Module 8 actually dispatches generation jobs) — there was no privileged operation here that needed the orchestrator's service-role client.

## Security

Same baseline as every prior module: RLS from `CREATE TABLE`, explicit grants, full audit trail (now six tables deep through the generalized trigger). Nothing new to call out structurally — Advanced Mode's one real security property is that overriding *which* model gets used still can't select a model that isn't installed and enabled, so "Advanced Mode" can't be used to route around the registry's own gating.

## Tests

- `supabase/tests`: 75 SQL assertions (was 62) — 13 new in `ai_router.test.sql`.
- `apps/web`: 53 Vitest tests (unchanged) — the new admin page is a straightforward server-component data fetch, in the same category as Module 6's models page, which also wasn't given a dedicated frontend test; the logic worth testing (the router itself) lives in Postgres and is covered there.
- `services/ai-orchestrator`: 14 pytest tests (unchanged) — no orchestrator changes this module.

## Migration / setup instructions

`npx supabase db push` picks up the new migration.

## Deployment instructions

No new env vars, no change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` — all pass (53 tests, 25 routes, up from 24).
- `ruff check` / `mypy --strict` / `pytest` in the orchestrator — all pass, unaffected by this module as expected.
- `supabase/tests/run_tests.sh` — 75/75 assertions pass, after fixing the two real bugs described above.
- Live dev server: `/admin/routing` correctly 307s an unauthenticated request to `/login?next=...`, homepage still 200.
- **Not verified**: an actual platform admin viewing live routing decisions against real installed models on real GPU infrastructure — same limitation as every prior module, and doubly so here since it also depends on Module 6's install path actually working end-to-end against real infra.

## What's deliberately not in Module 7

Routing rule create/edit/reorder UI (schema and RLS are ready; direct SQL/Supabase access covers admin needs until there's a concrete reason to build the editor), task types for non-video categories (added when a real Studio module needs them), any actual dispatch of a generation job through the router (that's Module 8 — this module only makes "which model would handle this" answerable, not "go run it"), and benchmark-informed ranking for the category-fallback tier (currently a deterministic but arbitrary `(created_at, slug)` order — real ranking needs Module 6's still-deferred benchmark feature to produce data worth ranking on).
