-- Module 5: Script Studio.
--
-- Scoped down deliberately: script CRUD only, no AI analysis (scene/
-- character/location extraction) and no file upload/parsing. Both need
-- the AI Model Manager (Module 6) and AI Router (Module 7) to exist first
-- — building a one-off LLM integration now would just get replaced once
-- those land, and "Detect Scenes" is explicitly Scene Studio's job
-- (a separate module in the roadmap), not Script Studio's.
--
-- No script_versions table: every UPDATE is already captured by the
-- generic audit_log_trigger (old/new content in audit_logs.metadata),
-- which gives free history without a dedicated versioning table nobody
-- has asked to browse yet.

create type public.script_status as enum ('draft', 'final');

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  status public.script_status not null default 'draft',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scripts_project_id_idx on public.scripts (project_id);

create trigger set_updated_at
  before update on public.scripts
  for each row execute function public.set_updated_at();

create trigger audit_scripts
  after insert or update or delete on public.scripts
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS — same collaborative model as the Story Bible tables (Module 4):
-- any project member can select/insert/update/delete, not just the
-- creator or an org admin. A script is a working document the whole team
-- edits together.
-- ============================================================

alter table public.scripts enable row level security;

grant select, insert, update, delete on public.scripts to authenticated;

create policy "scripts_select" on public.scripts for select to authenticated
  using (public.is_project_member(project_id));
create policy "scripts_insert" on public.scripts for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "scripts_update" on public.scripts for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "scripts_delete" on public.scripts for delete to authenticated
  using (public.is_project_member(project_id));
