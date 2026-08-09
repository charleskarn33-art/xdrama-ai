# Module 16 — Admin Dashboard & Ops

**Status:** Complete. This is the last module on the original 16-module roadmap (`docs/00-technical-audit-and-roadmap.md`).

## Architecture

"Cross-cutting visibility into everything built so far" turned out to be genuinely blocked, not just missing a UI. A platform admin's Supabase session is subject to the exact same RLS as every other authenticated user, and every tenant table built since Module 2 — `organizations`, `projects`, `render_jobs`, `export_jobs`, `ai_suggestions`, `organization_members` — scopes `SELECT` to org/project membership. Only two things were already platform-admin-readable before this module: platform-level catalog tables (`ai_models`, `routing_rules`, `workflow_templates` — select-all for everyone, per Module 6/7/8) and `audit_logs` (Module 6 added a platform-admin `SELECT` policy there specifically). Nothing in the app had ever read `audit_logs` back, though, and there was no view of tenants, users, or cross-org job queues at all.

This module closes that gap in two layers:

1. **A migration that widens read access, additively, for platform admins only** — the same pattern Module 6 established for `audit_logs`: `create policy ... using (is_platform_admin())`, which Postgres RLS ORs together with every existing permissive policy. This can only ever add what a platform admin specifically can read; it changes nothing about what any other role can see or do, and grants no write access anywhere.
2. **Three new admin pages** built on top of that: a real Overview dashboard (replacing the old `/admin` → `/admin/models` redirect), a read-only Organizations browser, and a paginated Audit Log viewer.

**Deliberately scoped to operations metadata, not tenant content.** The new policies cover `organizations`, `organization_members`, `profiles`, `projects`, `render_jobs`, `export_jobs`, and `ai_suggestions` — enough to answer "how many tenants, how many users, is the job queue healthy, who owns what" without granting platform admins read access to `scripts`, `characters`, `voice_lines`, `timeline_clips`, or any other creative-content table. That boundary was a deliberate choice: SaaS ops tooling legitimately needs tenant/job-queue visibility; it does not need to read every user's unpublished screenplay, and nothing in this module's brief asked for that.

## Database changes

New migration: `supabase/migrations/20260809175302_admin_dashboard_ops.sql`. Seven new additive `SELECT` policies, one per table, all shaped exactly like Module 6's `audit_logs_select_platform_admin`:

- `organizations_select_platform_admin`
- `org_members_select_platform_admin`
- `profiles_select_platform_admin`
- `projects_select_platform_admin`
- `render_jobs_select_platform_admin`
- `export_jobs_select_platform_admin`
- `ai_suggestions_select_platform_admin`

No new tables, no new columns, no changes to any existing policy. `audit_log_trigger()` is unchanged — none of these are audited writes, since none of them write anything.

### Tested — 15 new assertions (195 total)

`supabase/tests/admin_dashboard_ops.test.sql`: a fresh org/project/workflow/render job/timeline/export job/AI suggestion owned by a user (`nadia`) who is a member of nothing else, then:
- **7 regression assertions** as a non-admin outsider (`otis`) confirming they still can't see any of it — proving the new policies didn't accidentally widen anyone else's access.
- **7 assertions** as a platform admin (`milo`, not a member of the org) confirming they *can* see all seven rows.
- **1 assertion** proving the new access is read-only: the same platform admin's attempt to rename the organization they don't belong to silently affects 0 rows, exactly like before this migration.

**Two pre-existing tests had to be fixed, not just left passing by luck.** `ai_workflow_engine.test.sql` and `export_studio.test.sql` each had a "user outside the org cannot see its render/export jobs" assertion that reused a user who was *also* promoted to platform admin earlier in the same file (for template/preset write-policy tests) — a coincidence of shared fixtures, not a deliberate test of the same thing this module tests. With the new platform-admin `SELECT` policy, that assertion's premise became false for that specific actor. Both were fixed by introducing a genuinely non-admin "outsider" user (`rex`, `iris`) for those specific checks, rather than by weakening or deleting the assertion — the underlying property being tested ("a non-member can't see this org's data") still holds and is still tested; it just needed an actor who is actually a non-member of *and not a platform admin over* that data.

## Frontend

- **`src/lib/admin/orchestrator-health.ts`** (new): `getOrchestratorHealth()` — a direct, unauthenticated `fetch` to the orchestrator's real `GET /health` endpoint (it takes no auth, unlike every other orchestrator route this app calls), with a 3s timeout and a try/catch that turns "unreachable" into an honest status rather than a crashed page. This is a live check run fresh on every load of the Overview page, not a cached or hardcoded value.
- **`/admin`** (rewritten — previously just `redirect("/admin/models")`): the Overview dashboard. Real counts (via `{count: "exact", head: true}` queries, now possible thanks to the new RLS policies) for organizations, users, projects, workflow templates, and routing rules; an AI Model Manager summary (registered/installed/enabled); a live orchestrator health badge; and status-breakdown cards for render jobs, export jobs, and AI suggestions, built by tallying each table's `status` column client-side (small enough tables that a grouped SQL query wasn't worth the extra RPC).
- **`/admin/organizations`** (new): every tenant, read-only — name, slug, owner (resolved via the new `profiles` platform-admin policy), member count, project count, created date. No edit/delete actions — see "what's deliberately not included" below.
- **`/admin/audit-log`** (new): the first UI to ever read `audit_logs` back. Paginated (50/page, `?page=` query param, `.range()`), newest first, with actor email and organization name resolved via batched `.in()` lookups against the page's referenced ids (the same "small batch of ids per page" join shape used for reference art and voice-line shot pickers in earlier modules). Platform-level rows (`org_id is null` — model/router/template writes) render with a blank organization column, matching the real data shape rather than hiding it.
- **`AdminNav`**: gained "Overview" (now the true index, with exact-match highlighting so it doesn't light up for every `/admin/*` route), "Organizations", and "Audit Log" tabs alongside the existing "Models"/"Router"/"Templates".

## Backend (AI orchestrator)

No changes — confirmed via `git status --porcelain -- services/ai-orchestrator`. The only orchestrator interaction this module added is a read-only call to the pre-existing, unauthenticated `/health` endpoint from the new dashboard page.

## Security

The core security work of this module *is* the RLS migration, not an afterthought to it. Every new policy is `SELECT`-only, additive (RLS ORs permissive policies — nothing existing was narrowed or replaced), and gated by the same `is_platform_admin()` helper every prior admin surface uses. No write policy was touched anywhere. The test suite's 8th new assertion (the "cannot rename an org they don't belong to" check) exists specifically to catch the mistake this kind of migration is most prone to — accidentally pairing a new read grant with write access nobody asked for.

## Tests

- `supabase/tests`: **195 SQL assertions** (was 180) — 15 new in `admin_dashboard_ops.test.sql`, plus 2 pre-existing assertions repaired (not weakened) in `ai_workflow_engine.test.sql` and `export_studio.test.sql`.
- `apps/web`: **103 Vitest tests** (unchanged) — this module added no new client-side validation logic to unit test; its correctness lives in the RLS policies (SQL-tested) and is exercised through real Supabase queries in Server Components (verified live, see below).
- `services/ai-orchestrator`: unchanged — 38 passed, 4 skipped, `ruff check`/`mypy app` both clean, confirming this module made no backend changes.

## Migration / setup instructions

`npx supabase db push` picks up `20260809175302_admin_dashboard_ops.sql`. No new environment variables. No change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `pnpm typecheck` / `pnpm test` (103 tests) / `pnpm build` in `apps/web` — all pass; build output confirms `/admin`, `/admin/organizations`, and `/admin/audit-log` all compile as dynamic routes.
- `supabase/tests/run_tests.sh` against a local Postgres — **195 / 195 assertions passed**, including all 15 new Module 16 assertions and the 2 repaired pre-existing ones, individually confirmed via targeted grep of the `NOTICE: ok` output.
- `ruff check` / `mypy app` / `pytest -q` in the orchestrator (via its `.venv`) — all pass (38 passed, 4 skipped), confirming the "no backend changes" claim.
- Live dev server with placeholder Supabase credentials: unauthenticated requests to `/admin`, `/admin/organizations`, and `/admin/audit-log` all correctly 307 to `/login?next=...`.
- `git status --porcelain -- services/ai-orchestrator` — empty.

## What's deliberately not in Module 16

No organization edit/delete/suspend actions from the admin panel (visibility was the brief — "cross-cutting visibility into everything built so far" — not tenant management; deleting or suspending a paying customer's org is a high-blast-radius action that deserves its own deliberate design, not a drive-by addition here). No user management UI (promoting/demoting platform admins, banning users) — `is_platform_admin` remains a direct-SQL-only flag, the same posture Module 6 shipped it with; a UI for granting platform-admin privilege is itself a privilege-escalation surface that needs its own careful design, not something to bolt on as a side effect of a dashboard module. No billing/entitlements data (flagged as an open question in the original roadmap audit and never specified since — nothing to surface). No real-time/auto-refreshing dashboard (Supabase Realtime wiring for admin metrics; the roadmap named Realtime for render job status specifically, not admin aggregates — this is a page load, not a live feed). No per-tenant drill-down beyond what's already visible elsewhere (a tenant's projects/render jobs are one click away via the existing dashboard once impersonation exists, which this module does not add — platform admins see counts and metadata here, not a way to act as a tenant).
