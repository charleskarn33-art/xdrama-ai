# Module 12 — Voice, Music, Subtitle Studios + Lip Sync

**Status:** Complete, pending your approval to move to Module 13.

## Architecture

"Audio pipeline, parallel-buildable once Model Manager/Router exist" — true to that framing, this module adds no new generation mechanism at all. Every piece of it reuses infrastructure built in Modules 8/9:

- **Voice Studio** (`voice_lines`: dialogue text, optionally tied to a character and a shot) and **Music Studio** (`music_tracks`: a music prompt, optionally tied to a scene) generate audio through Module 9's workflow-subject linking, extended with two more subject types (`voice_line`, `music_track`) — the same `generateReferenceArt`/`ReferenceArtPanel` machinery already used for character reference images and storyboard frames, now also producing audio via new `character_voice_line` (voice category) and `scene_music` (audio category) routing_rules task types.
- **Lip Sync needs no new schema at all.** Module 8's workflow graph already supports multiple input nodes feeding one `model_task` (verified since Module 8's "multi-source links" compiler test) — a lip-sync workflow is just a video input + an audio input → `model_task(lip_sync)` → output, buildable today in the existing Workflow Builder with zero code changes here. This module only adds the `lip_sync` routing_rules row (pointing at the `musetalk`/`latentsync` models Module 6 already registered under the `lip_sync` category) so the router has something to select once a user builds one.
- **Subtitle Studio (`subtitles`) is deliberately *not* AI-generated.** There is no speech-to-text/ASR category anywhere in the Module 6 model taxonomy (video/image/audio/voice/lip_sync/llm) — inventing one to justify an "AI subtitles" feature would mean fabricating an unverifiable model integration, the exact trap this project has avoided since Module 6's honesty rules were established. Subtitles are timed captions a user authors directly against a `movie_timelines` row, optionally copying a voice line's text as a starting point rather than retyping it.
- **`ReferenceArtPanel` gained three optional props** (`title`, `generateLabel`, `emptyLabel`) instead of a rename. The component now generates audio as often as images, and "Reference art" was no longer an accurate default heading for a voice line's panel — but the underlying mechanism (find-or-create a subject-linked workflow, dispatch, show status via Realtime) is identical regardless of asset type, so extending it with display-only props was the proportionate fix, not a rename of `src/lib/reference-art/*` across five already-committed modules.

## Database changes

New migration: `supabase/migrations/20260809165203_voice_music_subtitle_lip_sync.sql`.

- **`workflow_subject_type` gains two more values**: `voice_line`, `music_track` (alongside Module 9's `character`/`location`/`prop` and Module 10's `shot`). Both `ALTER TYPE ... ADD VALUE` statements are the first two statements in the file, before anything in the same migration references them — the same empirically-verified ordering constraint documented in Module 10's migration.
- **`voice_lines`**: `project_id`, `character_id` (nullable, cross-validated), `shot_id` (nullable, cross-validated), `line_order`, `text`, `created_by`, timestamps.
- **`music_tracks`**: `project_id`, `scene_id` (nullable, cross-validated), `name`, `description`, `created_by`, timestamps.
- **`subtitles`**: `project_id` (trigger-derived from `timeline_id`, the same shape as Module 11's `timeline_clips`), `timeline_id`, `voice_line_id` (nullable, cross-validated against the same project), `start_seconds`/`end_seconds` (a check constraint enforces `end > start`), `text`, `created_by`, timestamps.
- **`validate_workflow_subject()` extended** to six branches total (character/location/prop/shot/voice_line/music_track).
- Seed: `character_voice_line`, `scene_music`, `lip_sync` routing_rules rows.
- All three new tables have a plain `project_id` column (client-supplied on `voice_lines`/`music_tracks`, trigger-derived on `subtitles`), so `audit_log_trigger()`'s existing generic branch already covers them — **zero changes needed there**, the fourth module in a row (after 9, 10, 11) where this held.

### Tested — 22 new assertions (156 total)

`supabase/tests/voice_music_subtitle_lip_sync.test.sql`: the three new routing_rules rows and their categories; the router honestly returning all-null for `character_voice_line` with nothing installed; a voice line linked to both a character and a shot with its audit trail; a voice line rejecting a nonexistent `character_id`; a music track linked to a scene with its audit trail; a subtitle's `project_id` correctly derived from its timeline with its audit trail; the `end_seconds > start_seconds` check constraint; a workflow linking to a voice line and to a music track via the two new subject types; a music track rejecting a `scene_id` from a different project; a subtitle rejecting a `voice_line_id` from a different project; collaborative edit by a non-creator member across all three tables; a subtitle actually deletable; cross-org isolation; `anon` blocked.

## Backend (AI orchestrator)

**No changes** — confirmed via `git status`. Voice and music generation dispatch through the identical `/v1/render-jobs/{id}/dispatch` endpoint every prior generation has used; lip sync needs no orchestrator awareness since it's just another workflow graph.

## Frontend

- **`/dashboard/[orgSlug]/projects/[projectId]/voice`**, **`.../voice/new`**, **`.../voice/[voiceLineId]`**: voice line list/create/edit/delete, with optional character and shot pickers (shots fetched via the same two-query scene-then-shots lookup Module 11 established, to avoid a fragile nested-embed filter), plus a `ReferenceArtPanel` titled "Voice audio" generating `audio` rather than a `reference image`.
- **`/dashboard/[orgSlug]/projects/[projectId]/music`**, **`.../music/new`**, **`.../music/[musicTrackId]`**: music track list/create/edit/delete, with an optional scene picker, plus a `ReferenceArtPanel` titled "Track audio".
- **Subtitles are managed inline on the timeline detail page** (`movies/[timelineId]/page.tsx`, gaining a third card) rather than a separate route — captions are inherently a property of a specific timeline, the same reasoning that put shots inline on their scene's detail page in Module 10. The subtitle form can optionally copy a voice line's text via a select.
- **Project tabs** gained "Voice Studio" and "Music Studio" entries (subtitles don't need their own tab — they're reached via Movie Composer).
- `src/lib/validations/audio-studio.ts`: Zod schemas for voice lines, music tracks, and subtitles (the latter sharing the same start/end-ordering refinement pattern as Module 11's clip trim points).

## Security

Same layered RBAC as every module since Module 4: `is_project_member()` throughout, full audit trail (all three new tables fit the existing generic branch), and the same cross-table integrity discipline (`validate_voice_line_refs`, `validate_music_track_refs`, `set_subtitle_project`) load-bearing since Module 4. No new privilege boundary — voice and music generation run through the exact same user-scoped dispatch endpoint and RLS-backed `workflows`/`render_jobs` policies every prior generation module has used.

## Tests

- `supabase/tests`: **156 SQL assertions** (was 134) — 22 new in `voice_music_subtitle_lip_sync.test.sql`.
- `apps/web`: **92 Vitest tests** (was 84) — 8 new covering the voice line/music track/subtitle Zod schemas.
- `services/ai-orchestrator`: **29 pytest tests** (unchanged) — no orchestrator changes this module.

## Migration / setup instructions

`npx supabase db push` picks up the new migration. No new environment variables, no change to the deployment shape.

## Verification performed this session

- `pnpm lint` / `typecheck` / `test` / `build` in `apps/web` — all pass (92 tests, 43 routes including the six new voice/music routes).
- `services/ai-orchestrator`: no files changed; its existing 29/29 pytest + ruff/mypy pass from Modules 8–11 stands unmodified.
- `supabase/tests/run_tests.sh` — 156/156 assertions pass.
- Live dev server with dummy Supabase credentials: `/dashboard/acme/projects/.../voice`, `.../voice/new`, `.../voice/[id]`, `.../music`, `.../music/new`, `.../music/[id]`, and the updated `.../movies/[id]` (with its new Subtitles card) all correctly 307 an unauthenticated request to `/login?next=...`.
- **Not verified**: an actual generated voice line, music track, or lip-synced clip against real GPU/ComfyUI infrastructure — the honest-failure boundary is unchanged from Module 8/9, since this module deliberately adds no new infrastructure-dependent code.

## What's deliberately not in Module 12

Speech-to-text/ASR-driven automatic subtitle generation (no ASR model category exists in the taxonomy — see the architecture note above; subtitles stay user-authored until a real ASR integration is verifiable); a dedicated lip-sync workflow template or UI beyond "buildable today in the existing Workflow Builder" (the brief's Templates module, if it ever curates named starter graphs the way Module 8's five movie templates do, is the natural home for a lip-sync starter — not fabricated here); subtitle editing after creation (create/delete only, matching the "list + add + delete" scope Module 10 used for shot-character tagging rather than a full inline-edit form); and, as with every module since Module 6, any of this actually rendering against real GPU/ComfyUI infrastructure.
