-- Module 13: AI Director / Cinematographer / Producer.
--
-- "Higher-level suggestion layers on top of the working pipeline — most
-- valuable once there's a pipeline to advise on." By Module 12 there is
-- one: Story Bible, Script Studio, Scenes/Shots, Movie Composer. This
-- module adds a place to request LLM-generated advice against that real
-- project state, through the same Model Manager + Router every other
-- generation feature uses — not a new, unverified integration with a
-- hosted LLM API. The brief's architecture governs locally-installed
-- models on the platform operator's own GPU infrastructure (the 'llm'
-- category models Module 6 already registered: qwen, llama, deepseek);
-- it never mentions an external hosted-API path, and no such
-- integration has been configured anywhere in this project, so this
-- module doesn't invent one. With nothing installed, requesting advice
-- honestly fails the same way every other generation feature does.

create type public.ai_advisor_role as enum ('director', 'cinematographer', 'producer');
create type public.ai_suggestion_status as enum ('pending', 'running', 'completed', 'failed');

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role public.ai_advisor_role not null,
  prompt text not null check (char_length(prompt) between 1 and 20000),
  status public.ai_suggestion_status not null default 'pending',
  result jsonb,
  error_message text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.ai_suggestions is 'A request for LLM-generated advice from one of the three advisor roles, scoped to a project. Append-mostly history, like render_jobs — see the RLS grants below.';

create index ai_suggestions_project_id_idx on public.ai_suggestions (project_id, created_at desc);
create index ai_suggestions_role_idx on public.ai_suggestions (role);

create trigger set_updated_at before update on public.ai_suggestions
  for each row execute function public.set_updated_at();

-- project_id is a plain client-supplied column, so audit_log_trigger's
-- existing generic branch already covers this table — no changes needed.
create trigger audit_ai_suggestions after insert or update or delete on public.ai_suggestions
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS: collaborative read/insert/update, same as render_jobs — no
-- delete grant at all, so an advisory request (and whatever the LLM
-- said) can't be erased, only ever added to.
-- ============================================================

alter table public.ai_suggestions enable row level security;

grant select, insert, update on public.ai_suggestions to authenticated;

create policy "ai_suggestions_select" on public.ai_suggestions for select to authenticated
  using (public.is_project_member(project_id));
create policy "ai_suggestions_insert" on public.ai_suggestions for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "ai_suggestions_update" on public.ai_suggestions for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

-- ============================================================
-- Seed the three advisor task types, llm category, matching the
-- product brief's role names exactly.
-- ============================================================

insert into public.routing_rules (task_type, category, description, preferred_model_slugs) values
  ('director_suggestions', 'llm', 'Story/performance/pacing advice on a project''s script and scenes.', array['qwen', 'llama', 'deepseek']),
  ('cinematographer_suggestions', 'llm', 'Shot composition, coverage, and visual style advice.', array['qwen', 'llama', 'deepseek']),
  ('producer_suggestions', 'llm', 'Scope, schedule, and resourcing advice across a project.', array['qwen', 'llama', 'deepseek']);
