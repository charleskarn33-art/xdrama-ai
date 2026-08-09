-- Module 11: Timeline Editor & Movie Composer.
--
-- "Assembly layer, depends on rendered scene assets existing." No shot
-- has a real rendered video clip yet (no GPU infrastructure — same
-- honest gap every module since 6 has had), so this module builds the
-- assembly/editing layer itself: named timelines, each an ordered
-- sequence of clips sourced from shots, with per-clip trim points and
-- transitions. A clip can optionally point at a specific render_jobs row
-- once one exists and completes (`source_render_job_id`) — the column
-- and its integrity guard are real and tested, but no UI is built for
-- attaching one yet, since nothing has produced a real video asset to
-- attach. Actually compositing/exporting a final movie file is Module
-- 14's job (Export Studio), once real rendering exists to compose.

create table public.movie_timelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.timeline_transition as enum ('cut', 'fade', 'dissolve', 'wipe');

-- project_id is trigger-populated from timeline_id (never client-supplied)
-- — the same "derived, not trusted" shape as Module 10's shots.project_id.
create table public.timeline_clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  timeline_id uuid not null references public.movie_timelines (id) on delete cascade,
  shot_id uuid not null references public.shots (id) on delete cascade,
  clip_order integer not null default 0,
  trim_start_seconds numeric(6, 2) check (trim_start_seconds is null or trim_start_seconds >= 0),
  trim_end_seconds numeric(6, 2) check (trim_end_seconds is null or trim_end_seconds > 0),
  transition_in public.timeline_transition not null default 'cut',
  source_render_job_id uuid references public.render_jobs (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_clips_trim_order_check check (
    trim_start_seconds is null or trim_end_seconds is null or trim_end_seconds > trim_start_seconds
  )
);

create or replace function public.set_timeline_clip_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timeline_project uuid;
  v_shot_project uuid;
  v_job_project uuid;
begin
  select project_id into v_timeline_project from public.movie_timelines where id = new.timeline_id;
  if v_timeline_project is null then
    raise exception 'timeline_id must reference an existing timeline';
  end if;

  select project_id into v_shot_project from public.shots where id = new.shot_id;
  if v_shot_project is null then
    raise exception 'shot_id must reference an existing shot';
  end if;

  if v_timeline_project is distinct from v_shot_project then
    raise exception 'A clip''s shot must belong to the same project as its timeline';
  end if;

  if new.source_render_job_id is not null then
    select project_id into v_job_project from public.render_jobs where id = new.source_render_job_id;
    if v_job_project is null or v_job_project is distinct from v_timeline_project then
      raise exception 'source_render_job_id must reference a render job in the same project';
    end if;
  end if;

  new.project_id := v_timeline_project;
  return new;
end;
$$;

create trigger set_timeline_clip_project
  before insert or update of timeline_id, shot_id, source_render_job_id on public.timeline_clips
  for each row execute function public.set_timeline_clip_project();

create index movie_timelines_project_id_idx on public.movie_timelines (project_id);
create index timeline_clips_timeline_id_order_idx on public.timeline_clips (timeline_id, clip_order);
create index timeline_clips_shot_id_idx on public.timeline_clips (shot_id);

create trigger set_updated_at before update on public.movie_timelines
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.timeline_clips
  for each row execute function public.set_updated_at();

-- Both tables have a plain project_id column (client-supplied on
-- movie_timelines, trigger-derived on timeline_clips), so
-- audit_log_trigger's existing generic branch already covers them — no
-- changes needed there, same as Module 10's shots/shot_characters.
create trigger audit_movie_timelines after insert or update or delete on public.movie_timelines
  for each row execute function public.audit_log_trigger();
create trigger audit_timeline_clips after insert or update or delete on public.timeline_clips
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS: collaborative, same shape as scenes/shots — any project member
-- reads/writes/deletes.
-- ============================================================

alter table public.movie_timelines enable row level security;
alter table public.timeline_clips enable row level security;

grant select, insert, update, delete on public.movie_timelines to authenticated;
grant select, insert, update, delete on public.timeline_clips to authenticated;

create policy "movie_timelines_select" on public.movie_timelines for select to authenticated
  using (public.is_project_member(project_id));
create policy "movie_timelines_insert" on public.movie_timelines for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "movie_timelines_update" on public.movie_timelines for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "movie_timelines_delete" on public.movie_timelines for delete to authenticated
  using (public.is_project_member(project_id));

-- project_id is trigger-set on timeline_clips (see set_timeline_clip_project),
-- so, as with Module 10's shots, the WITH CHECK still evaluates
-- is_project_member(project_id) — just against the trigger-populated value.
create policy "timeline_clips_select" on public.timeline_clips for select to authenticated
  using (public.is_project_member(project_id));
create policy "timeline_clips_insert" on public.timeline_clips for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "timeline_clips_update" on public.timeline_clips for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "timeline_clips_delete" on public.timeline_clips for delete to authenticated
  using (public.is_project_member(project_id));
