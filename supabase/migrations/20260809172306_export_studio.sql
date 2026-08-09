-- Module 14: Export Studio.
--
-- "Multi-format/platform export, depends on Movie Composer output." No
-- clip in this deployment has a real rendered video asset yet (no GPU
-- infrastructure, the same honest gap every module since 6 has had), so
-- an export can never actually produce a file today — but the structure
-- (named export presets for real platforms, export jobs tracking status
-- against a movie timeline) is real and tested, and the dispatch
-- endpoint reports the actual reason it can't proceed rather than
-- faking success.
--
-- export_presets is platform-level (like ai_models/workflow_templates),
-- not project-scoped: the same handful of named formats apply to every
-- project. Seeded with five real, verifiable platform specs (not
-- fabricated numbers) — YouTube landscape, YouTube Shorts, TikTok,
-- Instagram Reels, Instagram Feed square.

create table public.export_presets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  platform text not null check (char_length(platform) between 1 and 100),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  format text not null check (format in ('mp4', 'mov', 'webm')),
  fps integer not null default 30 check (fps > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.export_presets is 'Platform-wide export format catalog, same admin-managed shape as ai_models/workflow_templates. Not project-scoped.';

create trigger set_updated_at before update on public.export_presets
  for each row execute function public.set_updated_at();

alter table public.export_presets enable row level security;

grant select on public.export_presets to authenticated;
grant insert, update, delete on public.export_presets to authenticated;

create policy "export_presets_select_all" on public.export_presets for select
  to authenticated using (true);
create policy "export_presets_insert_platform_admin" on public.export_presets for insert
  to authenticated with check (public.is_platform_admin());
create policy "export_presets_update_platform_admin" on public.export_presets for update
  to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "export_presets_delete_platform_admin" on public.export_presets for delete
  to authenticated using (public.is_platform_admin());

-- ============================================================
-- export_jobs: project-scoped, one per export attempt against a movie
-- timeline. project_id is trigger-derived from timeline_id — the same
-- "derive, don't trust the client" shape as Module 11's timeline_clips.
-- ============================================================

create type public.export_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  timeline_id uuid not null references public.movie_timelines (id) on delete cascade,
  preset_id uuid references public.export_presets (id) on delete set null,
  status public.export_job_status not null default 'queued',
  output_asset_url text,
  error_message text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create or replace function public.set_export_job_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id from public.movie_timelines where id = new.timeline_id;

  if v_project_id is null then
    raise exception 'timeline_id must reference an existing movie timeline';
  end if;

  new.project_id := v_project_id;
  return new;
end;
$$;

create trigger set_export_job_project
  before insert or update of timeline_id on public.export_jobs
  for each row execute function public.set_export_job_project();

create index export_jobs_project_id_idx on public.export_jobs (project_id, created_at desc);
create index export_jobs_timeline_id_idx on public.export_jobs (timeline_id);

create trigger set_updated_at before update on public.export_jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- audit_log_trigger gains export_presets as a fourth platform-level
-- table (alongside ai_models, routing_rules, workflow_templates);
-- export_jobs fits the existing generic project_id branch as-is.
-- ============================================================

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_target_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_table_name = 'organizations' then
    v_org_id := coalesce(new.id, old.id);
    v_target_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name = 'organization_members' then
    v_org_id := coalesce(new.org_id, old.org_id);
    v_target_id := coalesce(new.user_id, old.user_id)::text;
  elsif tg_table_name = 'projects' then
    v_org_id := coalesce(new.org_id, old.org_id);
    v_target_id := coalesce(new.id, old.id)::text;
  elsif tg_table_name in ('ai_models', 'routing_rules', 'workflow_templates', 'export_presets') then
    v_org_id := null;
    v_target_id := coalesce(new.id, old.id)::text;
  else
    -- project-scoped tables (characters, locations, character_relationships,
    -- timeline_events, story_bible_notes, scripts, props, workflows,
    -- render_jobs, scenes, shots, shot_characters, movie_timelines,
    -- timeline_clips, voice_lines, music_tracks, subtitles,
    -- ai_suggestions, export_jobs, and any future one with a plain
    -- project_id column): resolve org_id via the parent project.
    select p.org_id into v_org_id
    from public.projects p
    where p.id = coalesce(new.project_id, old.project_id);
    v_target_id := coalesce(new.id, old.id)::text;
  end if;

  if tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  insert into public.audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_target_id,
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_export_presets after insert or update or delete on public.export_presets
  for each row execute function public.audit_log_trigger();
create trigger audit_export_jobs after insert or update or delete on public.export_jobs
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS: export_jobs is append-mostly history, like render_jobs and
-- ai_suggestions — no delete grant, so an export attempt (and whatever
-- it honestly reported) can't be erased.
-- ============================================================

alter table public.export_jobs enable row level security;

grant select, insert, update on public.export_jobs to authenticated;

create policy "export_jobs_select" on public.export_jobs for select to authenticated
  using (public.is_project_member(project_id));
create policy "export_jobs_insert" on public.export_jobs for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "export_jobs_update" on public.export_jobs for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

-- ============================================================
-- Seed five real, verifiable platform export presets.
-- ============================================================

insert into public.export_presets (slug, name, platform, width, height, format, fps, description) values
  ('youtube-landscape', 'YouTube (Landscape)', 'youtube', 1920, 1080, 'mp4', 30, 'Standard 16:9 upload format for YouTube.'),
  ('youtube-shorts', 'YouTube Shorts', 'youtube_shorts', 1080, 1920, 'mp4', 30, 'Vertical 9:16 format for YouTube Shorts.'),
  ('tiktok', 'TikTok', 'tiktok', 1080, 1920, 'mp4', 30, 'Vertical 9:16 format for TikTok.'),
  ('instagram-reels', 'Instagram Reels', 'instagram_reels', 1080, 1920, 'mp4', 30, 'Vertical 9:16 format for Instagram Reels.'),
  ('instagram-feed-square', 'Instagram Feed (Square)', 'instagram_feed', 1080, 1080, 'mp4', 30, 'Square 1:1 format for the Instagram feed.');
