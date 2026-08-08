# Module 4 — Story Bible

**Status:** Complete, pending your approval to move to Module 5.

## Architecture

The Story Bible is the consistency backbone the brief calls for: Characters, Locations, Relationships, Timeline, and "Universe Memory." Every future creative studio (Script, Storyboard, Character, Environment) reads from and writes to these tables rather than each inventing its own notion of "who is this character."

**Scoping decision**: entities belong to a **project**, not the whole organization. A character in "Project A" is not automatically available in "Project B," even within the same org. The brief's "Reusable Characters" language could be read as cross-project (franchise/universe) reuse, but nothing in the schema so far models a "universe" grouping above a project, and inventing one now would be speculative — noted explicitly as deferred, not forgotten.

**Five tables, one new RBAC primitive**: `characters`, `locations`, `character_relationships`, `timeline_events`, `story_bible_notes` (the last one covers "Universe Memory"/History/lore — free-form notes that don't fit a character, location, or timeline entry). All five reuse `is_org_member()`/`has_org_role()` from Module 2 through a new composed helper, `is_project_member(project_id)`, which just checks org membership of the project's org — demonstrating the "reusable RBAC primitives" pattern actually paying off three modules later.

**RBAC is deliberately more permissive than `projects`**: any project member can delete a character, location, timeline event, or note — not just its creator or an org admin. This is a considered inconsistency with Module 3, not a bug: story bible entries are working creative documents meant to be edited collaboratively, and losing one is a much smaller mistake than losing the project container itself (which kept the stricter creator-or-admin rule).

**Cross-project data integrity**: `character_relationships` links two characters, and nothing about foreign keys alone stops someone from linking a character in Project A to one in Project B. A `BEFORE INSERT/UPDATE` trigger (`set_relationship_project`) rejects that — and also auto-populates the relationship's `project_id` from the characters involved, so the client never has to pass it and can't get it wrong.

## Database changes

New migration: `supabase/migrations/20260808210837_story_bible.sql`.

- `public.is_project_member(p_project_id)` — composed from `is_org_member`, `SECURITY DEFINER` with `search_path = ''` per the established pattern.
- `characters` (name, description, appearance, personality, voice_description), `locations` (name, description), `timeline_events` (title, description, in_story_date — free text, since fictional calendars don't fit `date`/`timestamptz` — and an integer `event_order` for manual reordering), `story_bible_notes` (title, content).
- `character_relationships` (character_id, related_character_id, relationship_type, description) — `project_id` is trigger-populated, not client-supplied; `character_relationships_not_self` check constraint blocks self-relationships.
- **`audit_log_trigger()` extended again**: gained a branch for tables that have `project_id` but not `org_id` — resolves the org via a join to `projects`. This is the third generalization of this function (Module 2: organizations/members; Module 3: generic id+org_id; Module 4: id+project_id), each addition driven by an actual new table shape rather than speculative future-proofing.
- All five tables: RLS from `CREATE TABLE`, explicit grants to `authenticated` only, `updated_at` + audit triggers attached via a small `DO` block loop (avoiding five copy-pasted `CREATE TRIGGER` pairs).

### Tested — 41 assertions, all against real Postgres

Split the growing single test file into a shared harness (`supabase/tests/harness.sql` — the `test_assert`/`test_ctx` helpers, previously duplicated at the top of `rls.test.sql`) plus one file per concern. `run_tests.sh` now applies the harness once and loops over every `*.test.sql` file. This was a genuine refactor, not busywork — `story_bible.test.sql`'s 14 new assertions needed the same harness `rls.test.sql` already had, and duplicating it a second time would have meant three copies by Module 5.

New coverage (`supabase/tests/story_bible.test.sql`): character creation and its audit trail (org-scoped correctly through the project join), a relationship auto-populating `project_id` from its characters, a plain member reading/creating/updating/**deleting** story bible entries they didn't create (the deliberately-more-permissive rule, verified), cascade deletion of a character's relationships, the cross-project guard actually rejecting a relationship between characters in two different projects (same org, different projects — isolating the trigger's specific job from the RLS org-membership check), and cross-org isolation for characters/locations/notes.

## Frontend

- **Project sub-navigation** (`src/components/dashboard/project-tabs.tsx`, wired into a new `[projectId]/layout.tsx`): Settings / Characters / Locations / Timeline / Notes tabs shared by every project page. The existing project-settings page (Module 3) lost its now-redundant header since the layout provides it.
- **Characters**: list, create, and a detail page combining the edit form with a **relationships panel** — add/remove relationships to other characters in the same project via a `Select`, with both directions of a relationship shown (the row you created, and rows where you're the *related* character). Directional relationships are a deliberate simplification: `relationship_type` is phrased from the creating row's perspective, so an asymmetric type like "mentor of" reads correctly one direction and loosely the other — documented as a known limitation, not silently glossed over.
- **Locations, Notes**: list/new/detail, following the exact same shape as Characters minus relationships.
- **Timeline**: a single page (list + inline add form) rather than separate create/detail pages — event records are simple enough (title, in-story date, order) that a dedicated create page would be pure ceremony.
- New shadcn/ui usage: the relationship-type `Select` reuses the `Controller` pattern from Module 3's project-status field, kept consistent rather than reaching for a plain `<select>` (an earlier draft did exactly that and got corrected before commit — noted here because it's the kind of inconsistency that's cheap to introduce and easy to miss).

## Backend (AI orchestrator)

No changes. Nothing there needs character/location/timeline context yet — that starts mattering once Script Studio (Module 5) or the AI Router (Module 7) actually generate against this data.

## Security

Same baseline, extended: RLS from creation, explicit grants, full audit trail (now spanning five more tables through the generalized trigger), and the cross-project relationship guard is itself a data-integrity security property — without it, a compromised or buggy client could link story bible content across projects a user has access to but that shouldn't be connected.

## Tests

- `apps/web`: 42 Vitest tests (was 30) — 12 new cases for `src/lib/validations/story-bible.ts` covering all five entity schemas.
- `supabase/tests`: 41 SQL assertions (was 27), across `rls.test.sql` (27, unchanged) and the new `story_bible.test.sql` (14).
- CI: no workflow changes needed — `run_tests.sh`'s `*.test.sql` loop picks up the new file automatically.

## Migration / setup instructions

Nothing beyond `npx supabase db push`. Run `./supabase/tests/run_tests.sh` locally to exercise the new RLS suite before pushing to a real project.

## Deployment instructions

No change to the deployment shape from Modules 1–3.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` — all pass (42 tests, 19 routes built, up from 9).
- `supabase/tests/run_tests.sh` — 41/41 assertions pass.
- Live dev server: every new protected route (`/characters`, `/characters/new`, `/locations`, `/timeline`, `/notes` under a project) correctly 307s an unauthenticated request to `/login?next=...`, no 500s.
- **Not verified** (same limitation as every prior module): an actual logged-in walkthrough — create a character, link a relationship, add a timeline event — against a live Supabase project. Needs real credentials or the full local Supabase stack (Docker, unavailable in this sandbox). The data layer those flows depend on is what's been genuinely exercised.

## What's deliberately not in Module 4

No cross-project/franchise "universe" grouping (flagged above), no family-tree visualization (the data — directional relationships — supports building one later, but rendering a tree diagram is a UI feature for whenever a studio actually needs it), no costumes/props tables (Prop Library is its own module in the roadmap, not folded in here), no character image/consistent-face generation (that's Character Studio, Module 9, once the AI Model Manager and Router exist to actually generate against). This module is the data backbone those features will attach to — not those features themselves.
