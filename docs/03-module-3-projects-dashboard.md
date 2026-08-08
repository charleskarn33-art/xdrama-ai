# Module 3 — Projects & Dashboard Shell

**Status:** Complete, pending your approval to move to Module 4.

## Architecture

Every future creative module (Script Studio, Storyboard Studio, ...) attaches to a `project`, and every project belongs to exactly one organization. This module builds the two things that dependency implies:

1. **The `projects` table** — org-scoped, RLS-protected, following the RBAC pattern Module 2 established (`is_org_member()`/`has_org_role()`), but *without* a wrapping RPC. Module 2's `create_organization`/`add_organization_member` needed `SECURITY DEFINER` functions because they enforce multi-row invariants (an org always has an owner). A project has no such invariant — plain RLS-gated `INSERT`/`UPDATE`/`DELETE` is the right amount of machinery, not more. Worth stating explicitly since it's a deliberate inconsistency with Module 2, not an oversight.
2. **The org-scoped dashboard shell** (`/dashboard/[orgSlug]/...`) — the navigation frame every future studio's routes will nest inside. It's built with exactly one real nav item (Projects) rather than a set of placeholder links for studios that don't exist yet; adding the next studio means adding one entry to `buildNavItems()` (`src/components/dashboard/sidebar-nav.tsx`) plus its route — the shell itself doesn't change.

**Routing decision**: organization context is carried in the URL (`/dashboard/[orgSlug]/projects`), not client-side state or a cookie. This was the simplest option that also works correctly with RSC server components and RLS — the org is resolved server-side on every request via `requireOrgMembership()`, so there's no client/server sync problem and no risk of a stale "active org" surviving a browser refresh.

## Database changes

New migration: `supabase/migrations/20260808203532_projects.sql`.

- **`project_status` enum**: `draft`, `in_progress`, `completed`, `archived`.
- **`projects`**: `org_id`, `name`, `description`, `status`, `created_by` (defaults to `auth.uid()` — see the bug this caught, below).
- **RLS**: any org member can `SELECT`/`INSERT` (with `created_by = auth.uid()` enforced by `WITH CHECK`) and `UPDATE` any project in their org (deliberately not creator-restricted — this is a collaborative tool; any teammate should be able to edit a shared project). `DELETE` is restricted to the creator or an owner/admin, so one member can't accidentally destroy another's work.
- **`audit_log_trigger()` generalized**: Module 2's version only handled `organizations` (whose own `id` *is* the org id) and `organization_members` (no `id` column, keyed by `user_id`). `projects` is the first table with a plain `(id, org_id)` shape, so the function gained a generic branch, and now also handles `INSERT` (Module 2's org/membership inserts were logged explicitly by their RPCs; projects has no RPC, so the trigger covers all three operations here).

### Tested, again, not just reviewed

Extended `supabase/tests/rls.test.sql` with 10 more assertions (27 total) reusing the same fixtures. This caught a real bug immediately: the first version of the migration required `created_by` on every `INSERT` with no default, which the RLS `WITH CHECK` also required to equal `auth.uid()` — meaning the *only* value that could ever satisfy both was one the caller could get right by accident. Adding `default auth.uid()` fixed it and matches how the frontend actually calls it (never sends `created_by`).

New coverage: project creation defaults `created_by` correctly, creation is audited, a spoofed `created_by` is rejected, a plain member can see and update (but not delete) a project, an owner can delete any project in their org, deletion is audited, and cross-org isolation holds for projects the same way it holds for organizations (a non-member sees zero rows, and can't insert into an org they don't belong to).

## Frontend

- **`/dashboard`**: now a router, not just a list — one org redirects straight to `/dashboard/[slug]/projects`, multiple orgs shows a picker, zero orgs shows the Module 2 create-org form unchanged.
- **`/dashboard/[orgSlug]/layout.tsx`**: the shell. Sidebar (org switcher + nav), header (user menu with sign-out). Verifies org membership itself (`requireOrgMembership`, 404s a non-member) rather than trusting the URL — RLS would prevent data leakage regardless, but a 404 is a better failure mode than an empty-looking page.
- **`/dashboard/[orgSlug]/projects`**: grid of project cards, empty state, "New project" CTA.
- **`/dashboard/[orgSlug]/projects/new`**: React Hook Form + Zod, calls `createProject` server action, redirects to the new project on success.
- **`/dashboard/[orgSlug]/projects/[projectId]`**: edit form (name/description/status via a Select) plus a delete button, gated client-side (`canDelete`, mirroring the RLS rule) — the real enforcement is still the RLS policy; the client check just avoids showing a delete button that would silently no-op.
- **New shadcn/ui primitives**, hand-installed the same way as Module 1 (same network-policy block on `ui.shadcn.com`): `Textarea`, `Avatar`, `DropdownMenu`, `Select`.
- **`src/lib/supabase/session.ts`** (`requireUser`) and **`src/lib/supabase/orgs.ts`** (`requireOrgMembership`): extracted once a second call site needed the same "get the authenticated user or bounce" / "resolve org slug → id+role or 404" logic — not built speculatively ahead of need.

## Backend (AI orchestrator)

No changes. Still nothing on the orchestrator side needs project or org context yet.

## Security

Same baseline as Module 2, applied to a new table: RLS from `CREATE TABLE`, explicit grants (no auto-exposure), every mutation audited. One addition worth calling out — the `DELETE` policy is intentionally *not* "any org member," specifically so a new/junior member can't wipe out a colleague's work; this is the first place the RBAC roles (`member` vs `owner`/`admin`) actually gate something beyond org administration itself.

## Tests

- `apps/web`: 30 Vitest tests (was 22) — 8 new cases for `src/lib/validations/projects.ts` (create/update/delete schema validation, including the Zod `.uuid()` version-format gotcha documented in the test file's fixture choice).
- `supabase/tests`: 27 SQL assertions (was 17), all against real Postgres.
- CI: no workflow changes needed — the existing `database` job picks up the new migration and expanded test file automatically.

## Migration / setup instructions

Nothing beyond Module 1/2's instructions — `npx supabase db push` picks up the new migration.

## Deployment instructions

No change to the deployment shape. Nothing project-specific to configure on Vercel/Supabase beyond what's already documented.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` — all pass (30 tests, 9 routes built including the three new dynamic ones).
- `supabase/tests/run_tests.sh` — 27/27 assertions pass, including the newly-caught `created_by` default bug fixed before merge.
- Live dev server: `/`, `/login`, `/signup` return 200; unauthenticated requests to `/dashboard`, `/dashboard/acme/projects`, and `/dashboard/acme/projects/new` all correctly 307 to `/login?next=...` with the right destination preserved, no 500s.
- **Not verified** (same limitation as Modules 1–2): an actual logged-in walkthrough of creating an org, creating a project, editing it, and deleting it — needs a live Supabase project or the full local stack (Docker, unavailable in this sandbox). The RLS rules those flows depend on are the part that's actually been exercised for real, against genuine Postgres.

## What's deliberately not in Module 3

No project archiving/soft-delete beyond the `archived` status value (hard delete is the only delete), no project templates, no bulk actions, no search/filter on the projects grid, no per-project member/collaborator list distinct from org membership. All reasonable follow-ups once there's more than a name/description/status to manage — premature before Module 4+ gives projects actual content.
