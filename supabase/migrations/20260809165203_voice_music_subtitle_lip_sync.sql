-- Module 12: Voice, Music, Subtitle Studios + Lip Sync.
--
-- "Audio pipeline, parallel-buildable once Model Manager/Router exist."
-- Voice Studio (voice_lines: dialogue text, optionally tied to a
-- character and a shot) and Music Studio (music_tracks: a music prompt,
-- optionally tied to a scene) reuse Module 9's workflow-subject linking
-- again — a voice line's audio and a music track's audio are generated
-- through the exact same graph/compiler/queue/dispatch pipeline every
-- other generation in this app uses, not a new one.
--
-- Lip Sync needs no new schema at all: Module 8's workflow graph already
-- supports multiple input nodes feeding one model_task (tested since
-- Module 8's "multi-source links" compiler test), so a lip-sync workflow
-- — video input + audio input -> model_task(lip_sync) -> output — is
-- just an ordinary workflow a user builds in the existing Workflow
-- Builder. This migration only adds the routing_rules row so the router
-- has something to select for that task type.
--
-- Subtitle Studio (subtitles) is deliberately NOT AI-generated: there is
-- no speech-to-text/ASR category in the Module 6 model taxonomy (only
-- video/image/audio/voice/lip_sync/llm), and inventing one to justify an
-- "AI subtitles" feature would mean fabricating an unverifiable model
-- integration — the exact trap this project has avoided since Module 6.
-- Subtitles are timed captions a user authors directly against a movie
-- timeline (optionally copying a voice line's text as a starting point).

alter type public.workflow_subject_type add value 'voice_line';
alter type public.workflow_subject_type add value 'music_track';

-- ============================================================
-- voice_lines
-- ============================================================

create table public.voice_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  shot_id uuid references public.shots (id) on delete set null,
  line_order integer not null default 0,
  text text not null check (char_length(text) between 1 and 4000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_voice_line_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.character_id is not null and not exists (
    select 1 from public.characters where id = new.character_id and project_id = new.project_id
  ) then
    raise exception 'character_id must belong to the same project as the voice line';
  end if;

  if new.shot_id is not null and not exists (
    select 1 from public.shots where id = new.shot_id and project_id = new.project_id
  ) then
    raise exception 'shot_id must belong to the same project as the voice line';
  end if;

  return new;
end;
$$;

create trigger validate_voice_line_refs
  before insert or update of character_id, shot_id, project_id on public.voice_lines
  for each row execute function public.validate_voice_line_refs();

-- ============================================================
-- music_tracks
-- ============================================================

create table public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_music_track_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scene_id is not null and not exists (
    select 1 from public.scenes where id = new.scene_id and project_id = new.project_id
  ) then
    raise exception 'scene_id must belong to the same project as the music track';
  end if;

  return new;
end;
$$;

create trigger validate_music_track_refs
  before insert or update of scene_id, project_id on public.music_tracks
  for each row execute function public.validate_music_track_refs();

-- ============================================================
-- subtitles: timed captions against a movie timeline. project_id is
-- trigger-derived from timeline_id — the same shape as Module 11's
-- timeline_clips.project_id.
-- ============================================================

create table public.subtitles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  timeline_id uuid not null references public.movie_timelines (id) on delete cascade,
  voice_line_id uuid references public.voice_lines (id) on delete set null,
  start_seconds numeric(7, 2) not null check (start_seconds >= 0),
  end_seconds numeric(7, 2) not null check (end_seconds > start_seconds),
  text text not null check (char_length(text) between 1 and 500),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_subtitle_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timeline_project uuid;
  v_voice_line_project uuid;
begin
  select project_id into v_timeline_project from public.movie_timelines where id = new.timeline_id;
  if v_timeline_project is null then
    raise exception 'timeline_id must reference an existing timeline';
  end if;

  if new.voice_line_id is not null then
    select project_id into v_voice_line_project from public.voice_lines where id = new.voice_line_id;
    if v_voice_line_project is null or v_voice_line_project is distinct from v_timeline_project then
      raise exception 'voice_line_id must reference a voice line in the same project';
    end if;
  end if;

  new.project_id := v_timeline_project;
  return new;
end;
$$;

create trigger set_subtitle_project
  before insert or update of timeline_id, voice_line_id on public.subtitles
  for each row execute function public.set_subtitle_project();

-- ============================================================
-- Indexes, updated_at, audit triggers. All three tables have a plain
-- project_id column (client-supplied on voice_lines/music_tracks,
-- trigger-derived on subtitles) so audit_log_trigger's existing generic
-- branch already covers them — no changes needed there.
-- ============================================================

create index voice_lines_project_id_order_idx on public.voice_lines (project_id, line_order);
create index voice_lines_character_id_idx on public.voice_lines (character_id);
create index voice_lines_shot_id_idx on public.voice_lines (shot_id);
create index music_tracks_project_id_idx on public.music_tracks (project_id);
create index music_tracks_scene_id_idx on public.music_tracks (scene_id);
create index subtitles_timeline_id_start_idx on public.subtitles (timeline_id, start_seconds);

do $$
declare
  t text;
begin
  foreach t in array array['voice_lines', 'music_tracks', 'subtitles']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_log_trigger()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- RLS: collaborative, same shape as scenes/shots/timeline_clips.
-- ============================================================

alter table public.voice_lines enable row level security;
alter table public.music_tracks enable row level security;
alter table public.subtitles enable row level security;

grant select, insert, update, delete on public.voice_lines to authenticated;
grant select, insert, update, delete on public.music_tracks to authenticated;
grant select, insert, update, delete on public.subtitles to authenticated;

create policy "voice_lines_select" on public.voice_lines for select to authenticated
  using (public.is_project_member(project_id));
create policy "voice_lines_insert" on public.voice_lines for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "voice_lines_update" on public.voice_lines for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "voice_lines_delete" on public.voice_lines for delete to authenticated
  using (public.is_project_member(project_id));

create policy "music_tracks_select" on public.music_tracks for select to authenticated
  using (public.is_project_member(project_id));
create policy "music_tracks_insert" on public.music_tracks for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "music_tracks_update" on public.music_tracks for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "music_tracks_delete" on public.music_tracks for delete to authenticated
  using (public.is_project_member(project_id));

-- project_id is trigger-set on subtitles (see set_subtitle_project), so
-- WITH CHECK still evaluates is_project_member(project_id) — just
-- against the trigger-populated value, the same as timeline_clips.
create policy "subtitles_select" on public.subtitles for select to authenticated
  using (public.is_project_member(project_id));
create policy "subtitles_insert" on public.subtitles for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "subtitles_update" on public.subtitles for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "subtitles_delete" on public.subtitles for delete to authenticated
  using (public.is_project_member(project_id));

-- ============================================================
-- validate_workflow_subject() gains two more branches (voice_line,
-- music_track), alongside Module 9's character/location/prop and
-- Module 10's shot.
-- ============================================================

create or replace function public.validate_workflow_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  if new.subject_type is null then
    return new;
  end if;

  if new.subject_type = 'character' then
    select exists (
      select 1 from public.characters where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  elsif new.subject_type = 'location' then
    select exists (
      select 1 from public.locations where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  elsif new.subject_type = 'prop' then
    select exists (
      select 1 from public.props where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  elsif new.subject_type = 'shot' then
    select exists (
      select 1 from public.shots where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  elsif new.subject_type = 'voice_line' then
    select exists (
      select 1 from public.voice_lines where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  else
    select exists (
      select 1 from public.music_tracks where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'subject_id must reference an existing % in the same project', new.subject_type;
  end if;

  return new;
end;
$$;

-- ============================================================
-- Seed three new routing_rules: two audio-generation task types (voice,
-- music) backing Voice/Music Studio, plus lip_sync (the category Module
-- 6 already registered musetalk/latentsync under) so the router has
-- something to select once a user builds a lip-sync workflow by hand.
-- ============================================================

insert into public.routing_rules (task_type, category, description, preferred_model_slugs) values
  ('character_voice_line', 'voice', 'Text-to-speech for a character''s dialogue line.', array['coqui-tts', 'kokoro', 'piper']),
  ('scene_music', 'audio', 'Background score/music for a scene.', array['musicgen', 'stable-audio-open', 'audiocraft']),
  ('lip_sync', 'lip_sync', 'Lip-sync a video clip to an audio track.', array['musetalk', 'latentsync']);
