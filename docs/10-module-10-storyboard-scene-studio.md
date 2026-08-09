# Module 10 — Storyboard & Scene Studio

**Status:** Complete, pending your approval to move to Module 11.

## Architecture

"Visual scene planning, depends on Script Studio output + Character/Environment studios" — this module adds two layers on top of the Story Bible: **Scene Studio** (`scenes`, optionally anchored to a script and a location) and **Storyboard Studio** (`shots`, an ordered breakdown of each scene, each of which can tag the characters appearing in it). Both are new tables, but nothing about *how* they're generated, validated, or secured is new — every pattern is reused from a prior module:

- **Cross-project reference guards** (`validate_scene_refs`, checking a scene's `script_id`/`location_id` belong to the same project) are the same shape as Module 4's `set_relationship_project` guard on `character_relationships`.
- **Derived, not client-supplied, `project_id`** on `shots` (via `set_shot_project`, reading it off the parent scene) and on `shot_characters` (via `set_shot_character_project`, cross-checking both the shot's and the character's project) is the exact "derive and validate, don't trust the client" shape Module 4 established — and because both tables end up with a plain `project_id` column, `audit_log_trigger()`'s existing generic branch covers them with **zero changes**, the same way `character_relationships` needed none.
- **Storyboard frame generation reuses Module 9's workflow-subject linking rather than inventing a third generation path.** A shot is just another subject type: `workflow_subject_type` gains a fourth value (`'shot'`), `validate_workflow_subject()` gains a fourth branch, and a new `storyboard_frame` routing_rules task type (image category, chain `[flux, sdxl]`, matching Module 9's other three) gives the router something to select for it. The same `ReferenceArtPanel` component built in Module 9 is reused unchanged on the shot detail page — it was already generic over subject type, so "storyboard frame" support required no new component, only two data entries (`REFERENCE_ART_SUBJECT_TYPES`, `REFERENCE_ART_TASK_TYPE`).

**One real fix worth calling out**: the reference-art generation flow's `revalidatePath` call previously assumed every subject's detail page lives at `/{subjectType}s/{subjectId}` — true by coincidence for `character`/`location`/`prop`, but false for a shot, whose page is nested under its scene (`/scenes/{sceneId}/shots/{shotId}`). Rather than special-case shots with more pluralization logic, `ReferenceArtPanel` now reads the current page's path via `usePathname()` and passes it to the server action explicitly — a small refactor that also makes the character/location/prop paths correct by construction instead of by lucky pluralization.

## Database changes

New migration: `supabase/migrations/20260809162737_storyboard_scene_studio.sql`.

- **`alter type workflow_subject_type add value 'shot'`** — the very first statement in the file. Postgres requires a new enum value to be committed before any later statement in the same session can use it; verified directly against a scratch database before writing this migration (a bare `ALTER TYPE ADD VALUE` followed by a function referencing the new value, in one `psql -f` script, works because each top-level statement auto-commits under plain `-f` execution — the restriction only bites inside an explicit `BEGIN...COMMIT` block). Everything that references `'shot'` — the extended `validate_workflow_subject()`, the frontend — comes later in the same file or in later migrations, never before this line.
- **`scenes`**: `project_id`, `script_id` (nullable, cross-validated), `location_id` (nullable, cross-validated), `title`, `description`, `scene_order`, `created_by`, timestamps. RLS collaborative, same shape as `characters`/`locations`/`props`.
- **`shots`**: `project_id` (trigger-derived from `scene_id`), `scene_id`, `shot_order`, `shot_type` (free text, not an enum — the frontend constrains it to a fixed list via Zod, but the column stays open the way `characters.appearance` etc. are open text, not because a closed set wasn't considered), `description`, `duration_seconds`, `created_by`, timestamps.
- **`shot_characters`**: `project_id` (trigger-derived and cross-validated against both `shot_id` and `character_id`), unique on `(shot_id, character_id)`. RLS has no update policy (tagging is add/remove, not edit) — select/insert/delete only, matching the shape of a pure join table.
- **`validate_workflow_subject()` extended** to a fourth branch (`shots`), alongside Module 9's `character`/`location`/`prop`.
- Seed: the `storyboard_frame` routing_rules row described above.

### Tested — 17 new assertions (120 total)

`supabase/tests/storyboard_scene_studio.test.sql`: the seed migration's new task type and router behavior against it (resetting `flux`/`sdxl` state first — the same cross-file-state rule every module since 7 has had to apply); a scene linked to a script and a location; a scene rejecting a non-existent `script_id`; a shot's `project_id` correctly derived from its scene (not client-supplied) with its own audit trail; a character tagged in a shot with `project_id` correctly derived and cross-checked; tagging rejected across projects; a workflow linking to a shot via the new `'shot'` subject type; collaborative rename/edit/untag by a non-creator member; cross-org isolation for both `scenes` and `shots`; `anon` blocked.

## Backend (AI orchestrator)

**No changes** — confirmed via `git status`. Same reasoning as Module 9: storyboard frame generation dispatches through the identical `/v1/render-jobs/{id}/dispatch` endpoint, with zero orchestrator-side awareness that a render job happens to be for a shot rather than a character or a movie scene.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/scenes`**, **`.../scenes/new`**, **`.../scenes/[sceneId]`**: scene list (ordered by `scene_order`)/create/edit/delete, with optional script and location pickers (a `Select` with a `"none"` sentinel value translated to empty string, since Radix's `Select` doesn't accept an empty-string item value).
- **`.../scenes/[sceneId]`** also lists the scene's shots (ordered by `shot_order`) with an inline "add shot" form, linking each to its own detail page.
- **`.../scenes/[sceneId]/shots/[shotId]`**: shot edit form (order, type, description, duration), a character-tagging panel (`ShotCharactersPanel` — tagged list with remove buttons, a select-and-add form for untagged project characters), and a `ReferenceArtPanel` for the storyboard frame — the same component from Module 9, unmodified.
- **Project tabs** gained a "Scenes" entry.
- `src/lib/validations/storyboard.ts`: Zod schemas for scenes/shots/shot-character tagging, including a fixed `SHOT_TYPES` list (wide/medium/close_up/extreme_close_up/pov/over_the_shoulder/aerial) the frontend enforces even though the database column is open text.

## Security

Same layered RBAC as every module since Module 4: `is_project_member()` throughout, full audit trail (both new tables fit the existing generic branch, so the trail is complete without any trigger changes), and the same cross-table integrity discipline (`validate_scene_refs`, `set_shot_project`, `set_shot_character_project`) that's been load-bearing since Module 4's character relationships. No new privilege boundary: storyboard frame generation runs through the exact same user-scoped dispatch endpoint and RLS-backed tables every reference-art generation has since Module 9.

## Tests

- `supabase/tests`: **120 SQL assertions** (was 103 before Module 9's fix — 117 after Module 9, 120 now) — 17 new in `storyboard_scene_studio.test.sql`.
- `apps/web`: **75 Vitest tests** (was 66) — 9 new covering `createSceneSchema`/`updateSceneSchema`/`createShotSchema`/`addShotCharacterSchema`.
- `services/ai-orchestrator`: **29 pytest tests** (unchanged) — no orchestrator changes this module.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. No new environment variables, no change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (75 tests, 34 routes including the four new scene/shot routes).
- `services/ai-orchestrator`: no files changed; its existing 29/29 pytest + ruff/mypy pass from Module 8/9 stands unmodified.
- `supabase/tests/run_tests.sh` — 120/120 assertions pass.
- The `ALTER TYPE ... ADD VALUE` + same-file-usage ordering was verified empirically against a scratch Postgres database (both the failing "same transaction" case and the working "separate auto-committed statements" case) before being committed to the migration, the same "prototype before committing" discipline used for Module 8's cycle-detection trigger.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../scenes`, `.../scenes/new`, `.../scenes/[id]`, and `.../scenes/[id]/shots/[id]` all correctly 307 an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual storyboard frame rendering against real GPU/ComfyUI infrastructure — the honest-failure boundary is unchanged from Module 8/9, since this module deliberately adds no new infrastructure-dependent code.

## What's deliberately not in Module 10

Drag-and-drop shot/scene reordering (order is a plain integer field the user edits directly, the same as Module 4's `timeline_events.event_order` — a dedicated reorder UI is future work if the integer-editing UX proves insufficient); a visual storyboard "grid" view showing every shot's generated frame at once across a whole project (each shot's frame lives on its own detail page for now, the same scope cut as Module 9's per-subject-only reference art before a project-wide Asset Library exists); shot-level camera movement/lens metadata beyond the fixed `shot_type` list (the AI Cinematographer module is where richer, AI-assisted shot planning belongs); and, as with every module since Module 6, any of this actually rendering against real GPU/ComfyUI infrastructure.
