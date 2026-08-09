# Module 9 — Character / Environment / Prop Studios

**Status:** Complete, pending your approval to move to Module 10.

## Architecture

The roadmap describes this module as "reusable asset generation, built on Model Manager + Router + Story Bible" — and every one of those pieces already exists. Module 4 built `characters`/`locations`; Module 6 built the model registry; Module 7 built the router; Module 8 built a complete, tested pipeline for turning a small graph into a real render job (graph validation → ComfyUI compiler → Redis queue → dispatch, with Realtime status). This module's job is to connect them, not to build a fifth thing:

- **`props`** completes the Story Bible's three reusable-entity types (characters/locations/props — the "Character/Environment/Prop Studios" the brief names), built with the exact same project-scoped, collaborative shape as Module 4's `characters`/`locations`.
- **Reference-art generation deliberately reuses Module 8's engine rather than inventing a parallel one.** A character's reference image is just another workflow — `input (description) → model_task (character_reference_image) → output (image)` — run through the identical graph validation, compiler, queue, and dispatch code every movie-level workflow uses. The only new piece is a way to say "this workflow belongs to this character": a nullable `subject_type`/`subject_id` pair added to `workflows`, with a partial unique index guaranteeing one reference-art workflow per subject. Every generation click reuses that one workflow (updating its graph to the subject's current text first, so it never goes stale) and adds a new `render_jobs` row under it — the same "one workflow, many attempts" shape Module 8 already established for movie workflows.
- **Three new routing_rules task types** (`character_reference_image`, `environment_concept_art`, `prop_render`, all `image` category, chain `[flux, sdxl]`) give the router something to select between for these generations — same data-driven pattern as Module 7's original six, added by a real module that needs them rather than speculatively.
- Reference-art workflows are excluded from the main Workflows tab's list (`.is("subject_type", null)`), keeping that tab focused on movie/trailer/... level workflows; they're only reachable from the entity's own detail page, where they belong.

## Database changes

New migration: `supabase/migrations/20260809114311_character_environment_prop_studios.sql`.

- **`props`**: `project_id`, `name`, `description`, `appearance`, `created_by`, timestamps — identical shape and RLS to `locations` (any project member reads/writes/deletes; `audit_log_trigger()` needed no changes, since it already resolves org via any table with a plain `project_id` column).
- **`workflows.subject_type` / `workflows.subject_id`**: nullable, `workflow_subject_type` enum (`character | location | prop`). A `check ((subject_type is null) = (subject_id is null))` constraint keeps the pair consistent, and a partial unique index (`where subject_type is not null`) enforces one linked workflow per subject.
- **`validate_workflow_subject()`** (trigger, `security definer`, same pattern as Module 4's `set_relationship_project`): when `subject_type` is set, verifies a row with that id actually exists in the matching table (`characters`/`locations`/`props`) **and belongs to the same `project_id`** — the same cross-table integrity guard Module 4 used for character relationships, now guarding against linking a workflow to another project's character.
- Seed: three new `routing_rules` rows as described above.

### Tested — 14 new assertions (117 total, up from 103 after fixing one stale assertion)

`supabase/tests/character_environment_prop_studios.test.sql`: the seed migration's new task types and their image category; `select_model_for_task` working against a new task type (explicitly resetting `flux`/`sdxl`'s install state first — an earlier test file installs `flux` as part of its own fixtures, the same cross-file-state rule Module 7 already had to learn); prop CRUD and its audit trail; a workflow linking to a character in the same project; the partial unique index rejecting a second linked workflow for the same subject; the trigger rejecting a `subject_id` that doesn't exist in the matching table, a subject belonging to a *different* project, and a `subject_type` set without a matching `subject_id`; collaborative prop update/delete by a non-creator member; cross-org isolation for both `props` and subject-linked `workflows`; `anon` blocked from `props`.

One pre-existing test needed a real fix, not just a new assertion: `ai_router.test.sql` asserted `count(*) from routing_rules = 6`, which this migration's three new rows made false. Scoped it to `where category = 'video'` — preserving its original intent (the six video rules the brief names) without hardcoding a total that any future module adding routing rules would break again.

## Backend (AI orchestrator)

**No changes.** This is the point of reusing Module 8's pipeline instead of building a new one: `POST /v1/render-jobs/{id}/dispatch` already does everything a reference-art generation needs (compile the graph, check for render nodes, enqueue, honestly report the infrastructure gap), with zero awareness that a particular render job happens to be a character's reference image rather than a movie scene.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/props`**, **`.../props/new`**, **`.../props/[propId]`**: list/create/edit/delete, built to the exact pattern `locations` established in Module 4 (same file shapes: `actions.ts`, `page.tsx`, `new/new-prop-form.tsx`, `[propId]/edit-prop-form.tsx`), plus an `appearance` field like `characters` has, since that's the text reference-art generation actually uses.
- **`ReferenceArtPanel`** (`src/components/dashboard/reference-art-panel.tsx`): a shared client component, reused unchanged across the character, location, and prop detail pages. A "Generate reference image" / "Regenerate" button calls `generateReferenceArt`; a Supabase Realtime subscription (once a workflow id is known) keeps the job list's status live, matching Module 8's `render-panel.tsx`.
- **`generateReferenceArt`** (`src/lib/reference-art/actions.ts`, shared server action): finds-or-creates the subject's linked workflow (updating its graph to the subject's current description/appearance on every call), creates a `render_jobs` row, calls the orchestrator's existing dispatch endpoint, then **re-fetches the job row** before returning. That re-fetch matters: dispatch can synchronously fail the job server-side (e.g. "no render nodes configured"), and on a subject's *first* generation the Realtime subscription doesn't exist yet at insert time — subscribing only after the action returns would silently miss that update. Every generation after the first is still kept live by the same subscription Module 8 already proved out.
- **`buildReferenceArtGraph`** (`src/lib/reference-art/graph.ts`): a pure function producing the same minimal `input → model_task → output` shape as every Module 8 template, built from code instead of a stored template since its one parameter (the subject's description) comes from the Story Bible, not a form.
- The character and location detail pages each gained a "Reference art" card alongside their existing content; the new prop detail page has one from the start.

## Security

Same layered RBAC as every module since Module 4: `props` uses `is_project_member()` with the collaborative (any-member-deletes) policy shape. The new `validate_workflow_subject()` trigger is the only new integrity-sensitive code, and it's deliberately strict — cross-project subject linkage is rejected the same way Module 4 rejected cross-project character relationships. No new privilege boundary: reference-art generation runs through the exact same user-scoped-client dispatch endpoint and RLS-backed `render_jobs`/`workflows` policies Module 8 already had reviewed.

## Tests

- `supabase/tests`: **117 SQL assertions** (was 103) — 14 new in `character_environment_prop_studios.test.sql`, plus the one `ai_router.test.sql` fix described above.
- `apps/web`: **66 Vitest tests** (was 63) — 3 new covering `createPropSchema`.
- `services/ai-orchestrator`: **29 pytest tests** (unchanged) — no orchestrator changes this module, confirmed via `git status`.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. No new environment variables and no change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (66 tests, 31 routes including the three new `/props` routes).
- `services/ai-orchestrator`: no files changed; its existing 29/29 pytest + ruff/mypy pass from Module 8 stands unmodified.
- `supabase/tests/run_tests.sh` — 117/117 assertions pass.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../props`, `.../props/[id]`, and `.../props/new` all correctly 307 an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual reference image rendering against real GPU/ComfyUI infrastructure — the honest-failure boundary is unchanged from Module 8, since this module deliberately adds no new infrastructure-dependent code.

## What's deliberately not in Module 9

A dedicated Asset Library / gallery view spanning all of a project's generated reference art (that's its own named module in the brief's 24-module list — this module surfaces each subject's own generation history on its own detail page, which is sufficient until a cross-entity gallery is a concrete need); benchmark/quality-based model selection for the three new task types (same `[flux, sdxl]`-fixed-order limitation Module 7's category fallback already has, pending the still-deferred benchmark feature); prop categories/tags (kept as flat as `locations`, no speculative taxonomy); and, as with every module since Module 6, any of this actually rendering against real GPU/ComfyUI infrastructure.
