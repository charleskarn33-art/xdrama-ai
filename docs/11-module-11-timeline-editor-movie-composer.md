# Module 11 — Timeline Editor & Movie Composer

**Status:** Complete, pending your approval to move to Module 12.

## Architecture

The roadmap describes this module as "assembly layer, depends on rendered scene assets existing." No shot has a real rendered video clip yet — there's no GPU infrastructure, the same honest gap every module since 6 has had — so this module builds the assembly/editing layer itself, structured so it's ready the moment real renders exist, without fabricating a rendering step that doesn't.

- **`movie_timelines`**: named, project-scoped edit sequences. A project can have several (e.g. "Rough Cut", "Director's Cut") — the same one-project-many-named-things shape as `workflows`.
- **`timeline_clips`**: an ordered sequence of clips, each sourced from a `shots` row, with optional trim points and a transition-in type. `project_id` is trigger-derived from `timeline_id` rather than client-supplied — the exact "derive and validate, don't trust the client" pattern Module 10 used for `shots.project_id`, which is why `timeline_clips` needed **zero changes** to `audit_log_trigger()`'s existing generic branch.
- **`source_render_job_id`**: a real, tested, nullable column pointing at a specific `render_jobs` row — the mechanism by which a clip will eventually say "my video comes from this render," once shot-level video generation exists. It's cross-project-validated by the same trigger that derives `project_id`, but **no UI attaches one yet**, since nothing in this deployment has ever produced a real video asset to attach. The UI instead shows an honest "Rendered" / "Not yet rendered" badge per clip, computed from whether that column is set.
- **Deliberately not building a "Compose" render step.** Module 8's workflow engine has three node types (input/model_task/output) and no video-concatenation primitive — inventing one now would mean fabricating an unverifiable ComfyUI integration, the same trap the project has avoided since Module 6. Actually compositing an ordered sequence of rendered clips into one exported movie file is explicitly **Module 14's job (Export Studio)**, once Modules 12/13 and real rendering infrastructure exist to compose. This module's job is to produce a correct, ordered edit decision list — not to render it.

## Database changes

New migration: `supabase/migrations/20260809164214_timeline_editor_movie_composer.sql`.

- **`movie_timelines`**: `project_id`, `name`, `description`, `created_by`, timestamps. RLS collaborative, same shape as `scenes`/`workflows`.
- **`timeline_transition` enum**: `cut | fade | dissolve | wipe`.
- **`timeline_clips`**: `project_id` (trigger-derived), `timeline_id`, `shot_id`, `clip_order`, `trim_start_seconds`/`trim_end_seconds` (both nullable; a check constraint enforces `trim_end > trim_start` when both are set), `transition_in`, `source_render_job_id` (nullable), `created_by`, timestamps.
- **`set_timeline_clip_project()`** (trigger, `security definer`, same shape as Module 10's `set_shot_character_project`): derives `project_id` from `timeline_id`, and cross-validates that the clip's `shot_id` belongs to the same project *and*, if `source_render_job_id` is set, that it also belongs to the same project.
- RLS: collaborative — unlike `render_jobs` (no delete grant, preserving render history), `timeline_clips` **is** fully deletable by any project member, since removing a clip from an edit is an ordinary editing action, not something that needs to be preserved as history.

### Tested — 14 new assertions (134 total)

`supabase/tests/timeline_editor_movie_composer.test.sql`: a timeline created with an audit trail; a clip added with `project_id` correctly derived (not client-supplied) and its own audit trail; a clip referencing a real `render_jobs` row as its source asset; the trim-order check constraint rejecting `trim_end <= trim_start`; a clip rejected when its shot belongs to a different project; a clip rejected when its `source_render_job_id` belongs to a different project; collaborative rename/reorder by a non-creator member; a clip actually deletable (contrasted explicitly with `render_jobs`' delete-blocked history in the assertion's own description); cross-org isolation for both tables; `anon` blocked.

## Backend (AI orchestrator)

**No changes** — confirmed via `git status`. This module adds no generation step, so there was nothing for the orchestrator to do.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/movies`**, **`.../movies/new`**, **`.../movies/[timelineId]`**: timeline list/create/rename/delete, following the same list-then-detail pattern as `scenes`/`workflows`.
- **`.../movies/[timelineId]`** is the editor: an ordered list of clips (each a compact inline form — order, transition, trim start/end, remove — matching the always-editable-row density of Module 10's shot list) and an "add clip" form that picks from the project's shots (labeled by scene + shot order + a description snippet, fetched via a two-query scene-then-shots lookup rather than a fragile nested-embed filter).
- **Route naming**: the table is `movie_timelines` but the route is `/movies` and the tab label is "Movie Composer" — deliberately distinct from the existing `/timeline` route (Module 4's narrative `timeline_events`, a different concept entirely: in-story chronology, not an edit sequence) to avoid two confusingly-similar URLs.
- **Project tabs** gained a "Movie Composer" entry.
- `src/lib/validations/movie-composer.ts`: Zod schemas for timelines and clips, including a shared `trimOrdered` refinement reused by both the add and update clip schemas. One real fix during typecheck: an initial draft used `.default("cut")` on `transitionIn`, which makes a Zod schema's *input* type optional while its *output* type stays required — a mismatch `useForm`'s generic (bound to the resolver's input type) can't express. Removed the schema-level default in favor of the form's own `defaultValues`, which was already supplying it.

## Security

Same layered RBAC as every module since Module 4: `is_project_member()` throughout, full audit trail (both new tables fit the existing generic branch), and the same cross-table integrity discipline (`set_timeline_clip_project`) load-bearing since Module 4. No new privilege boundary — nothing in this module writes through the orchestrator or touches a service-role client.

## Tests

- `supabase/tests`: **134 SQL assertions** (was 120) — 14 new in `timeline_editor_movie_composer.test.sql`.
- `apps/web`: **84 Vitest tests** (was 75) — 9 new covering the timeline/clip Zod schemas.
- `services/ai-orchestrator`: **29 pytest tests** (unchanged) — no orchestrator changes this module.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. No new environment variables, no change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (84 tests, 37 routes including the three new movie/timeline routes).
- `services/ai-orchestrator`: no files changed; its existing 29/29 pytest + ruff/mypy pass from Modules 8–10 stands unmodified.
- `supabase/tests/run_tests.sh` — 134/134 assertions pass.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../movies`, `.../movies/new`, and `.../movies/[id]` all correctly 307 an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual composed/exported movie file, or a real shot-level video render to attach via `source_render_job_id` — neither exists yet in this deployment, and this module's job was to build the assembly layer up to that boundary, not fabricate what's beyond it.

## What's deliberately not in Module 11

Actually compositing/exporting a rendered movie file (Module 14's job, once real rendering exists to compose); a UI for attaching a `source_render_job_id` to a clip (the column and its integrity guard are real and tested, but there's no real per-shot video render to pick from yet — this is the same "schema ready, UI deferred until there's something real to point at" scope cut Module 8 made for workflow rename); drag-and-drop clip reordering (clip order is a plain integer field the user edits directly, the same as every ordered list since Module 4's `timeline_events.event_order`); and, as with every module since Module 6, any of this actually rendering against real GPU/ComfyUI infrastructure.
