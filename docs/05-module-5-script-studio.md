# Module 5 — Script Studio

**Status:** Complete, pending your approval to move to Module 6.

## Scoping decision (read this first)

The roadmap describes Module 5 as "script CRUD, script analysis (scene/character/location extraction) — first real AI integration point." This module ships the CRUD half only. Script analysis needs an actual AI model to call, and this project has no AI Model Manager (Module 6) or AI Router (Module 7) yet — building a one-off LLM integration now would mean either bypassing the router architecture the brief explicitly requires ("Users never choose models... The router automatically selects the best model") or hand-rolling something that gets discarded once Module 6/7 exist. Neither is a good use of the work. I raised this as an explicit choice before starting; getting no response, I went with the sound-engineering default: ship what's real today, defer what depends on infrastructure that doesn't exist yet. Same reasoning applies to file upload — "Upload Script" in the pipeline diagram implies parsing an uploaded file (PDF/Fountain/etc.), which is naturally part of the same later AI-integration work, not this one.

One more scoping note: "Detect Scenes" in the One-Click pipeline is Scene Studio's job, a separate module in the roadmap — not folded into Script Studio here.

## Architecture

`scripts` is a project-scoped table following the exact RLS/RBAC/audit pattern the Story Bible tables (Module 4) established: collaborative permissions (any project member can read/write/delete, not just the creator), `is_project_member()` for RLS, and the generic `audit_log_trigger()` — which needed no changes this time, since `scripts` has the same `(id, project_id)` shape the trigger already generalized for in Module 4.

**No `script_versions` table.** A script's edit history matters (writers want to see what changed), but there's no dedicated versioning table — every `UPDATE` is already captured by the audit trigger, with the full old/new row (including `content`) in `audit_logs.metadata`. Building a parallel versioning system would duplicate data the audit log already has. If a "diff view" UI is ever wanted, it reads from `audit_logs`; the schema doesn't need to change for that.

## Database changes

New migration: `supabase/migrations/20260808231636_scripts.sql`.

- `script_status` enum: `draft`, `final`.
- `scripts`: `project_id`, `title`, `content` (plain `text`, defaults to `''`), `status`, `created_by` (defaults to `auth.uid()`, per the Module 3 fix).
- RLS: identical shape to the Story Bible tables — `SELECT`/`INSERT`/`UPDATE`/`DELETE` all gated on `is_project_member(project_id)`, `INSERT` additionally checks `created_by = auth.uid()`.

### Tested — 10 new assertions (51 total)

`supabase/tests/scripts.test.sql`, using the shared harness from Module 4's refactor. Coverage: script creation defaults (`status = 'draft'`), creation audited with the right org, a spoofed `created_by` rejected, a plain member (not the creator) editing content and status, that edit's audit trail actually capturing both the old and new `content` values, a plain member deleting a script they didn't create, and cross-org isolation (can't see or create scripts for an org you're not in).

One real bug caught in the test itself, not the migration: the audit-trail assertion first ran while impersonating a plain "member" role — but `audit_logs` reads are owner/admin-only (Module 2's rule), so the member's session correctly saw zero rows and the assertion failed for the right reason. Fixed by switching the test's actor to the org owner before checking the audit log, which is what any real admin-facing "history" UI would need to do too — a useful thing to have hit in a test rather than discovered later.

## Frontend

- **New "Scripts" tab** in the project sub-navigation (`ProjectTabs`), placed second (right after Settings) to match the pipeline order in the brief — script comes before storyboard/characters/etc.
- **List/create/detail-edit** pages, following the exact shape established for Locations and Notes in Module 4: `scripts` (grid with status badge), `scripts/new`, `scripts/[scriptId]` (edit form with a status `Select` using the same `Controller` pattern as the project-status and character-relationship dropdowns).
- Script content is a large `Textarea` in a monospace font — a plain text editor, not a screenplay-formatting tool (fountain/PDF-style pagination, character-cue auto-indent, etc.). That's real functionality some filmmaking tools invest heavily in, and building it now — before there's any AI generation reading this content — would be scope creep relative to what this module actually needs to unblock.

## Backend (AI orchestrator)

No changes. First real work here lands in Module 6.

## Security

Same baseline as every prior module: RLS from `CREATE TABLE`, explicit grants, full audit trail. Nothing new to call out — this module's job was mostly to confirm the Module 4 patterns (RBAC helper reuse, generic audit trigger, collaborative delete policy) hold up unchanged for a fourth table shape, which they did.

## Tests

- `apps/web`: 49 Vitest tests (was 42) — 7 new cases for `src/lib/validations/scripts.ts`.
- `supabase/tests`: 51 SQL assertions (was 41) — 10 new in `scripts.test.sql`.
- CI: no workflow changes needed.

## Migration / setup instructions

Nothing beyond `npx supabase db push`.

## Deployment instructions

No change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` — all pass (49 tests, 22 routes, up from 19).
- `supabase/tests/run_tests.sh` — 51/51 assertions pass (after fixing the RBAC-visibility bug in the test itself, described above).
- Live dev server: `/scripts` and `/scripts/new` under a project both correctly 307 an unauthenticated request to `/login?next=...`, no 500s.
- **Not verified** (same limitation as every prior module): an actual logged-in walkthrough of writing and saving a script against a live Supabase project.

## What's deliberately not in Module 5

Script analysis / scene-character-location extraction (needs Modules 6–7 first, explained above), file upload/parsing, scene breakdown (Scene Studio's job), screenplay-specific formatting/pagination, version diffing UI (the data exists in `audit_logs`; no UI reads it yet because nothing has asked for it).
