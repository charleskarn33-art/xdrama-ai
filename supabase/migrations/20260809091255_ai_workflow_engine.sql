-- Module 8: AI Workflow Engine.
--
-- Internal workflow graph format (nodes/edges as jsonb — never ComfyUI's
-- own format; that translation happens only in the orchestrator's
-- compiler, see services/ai-orchestrator/app/workflows/), workflow
-- templates, and a render job queue with realtime status.
--
-- Two workflow tables, not one with a nullable project_id: templates
-- (platform-level, admin-curated, rarely change) and workflows
-- (project-scoped, created/edited by any project member) have different
-- enough access patterns that mixing them into one table with
-- conditional RLS would be more complex to reason about than two tables
-- reusing the exact patterns Modules 4-7 already established and tested.

create type public.render_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

-- ============================================================
-- Graph validation, shared by workflow_templates.graph and
-- workflows.graph. Node types are deliberately minimal (input/model_task/
-- output) — enough to demonstrate the engine and express the five
-- template categories the brief names, not a speculative full node
-- taxonomy for studios that don't exist yet.
-- ============================================================

create or replace function public.validate_workflow_graph()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graph jsonb := new.graph;
  v_has_cycle boolean;
begin
  if v_graph is null or not (v_graph ? 'nodes') or not (v_graph ? 'edges') then
    raise exception 'Workflow graph must have "nodes" and "edges" arrays';
  end if;

  if jsonb_typeof(v_graph->'nodes') <> 'array' or jsonb_typeof(v_graph->'edges') <> 'array' then
    raise exception '"nodes" and "edges" must be arrays';
  end if;

  if jsonb_array_length(v_graph->'nodes') = 0 then
    raise exception 'Workflow graph must have at least one node';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_graph->'nodes') as elem
    where elem->>'id' is null or elem->>'type' not in ('input', 'model_task', 'output')
  ) then
    raise exception 'Every node needs an id and a valid type (input, model_task, output)';
  end if;

  if (
    select count(*) from jsonb_array_elements(v_graph->'nodes') as elem
  ) <> (
    select count(distinct elem->>'id') from jsonb_array_elements(v_graph->'nodes') as elem
  ) then
    raise exception 'Node ids must be unique';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_graph->'edges') as elem
    where (elem->>'source') not in (select n->>'id' from jsonb_array_elements(v_graph->'nodes') as n)
       or (elem->>'target') not in (select n->>'id' from jsonb_array_elements(v_graph->'nodes') as n)
  ) then
    raise exception 'Every edge must reference existing node ids';
  end if;

  -- Cycle detection: a directed graph has a cycle iff some node can reach
  -- itself via one or more edges. `reachable` computes, for every
  -- starting node, the set of nodes reachable from it; UNION (not UNION
  -- ALL) deduplicates (start_node, reached) pairs, which is what
  -- guarantees this terminates even when the input graph does contain a
  -- cycle — verified against acyclic/cyclic/self-loop/diamond graphs
  -- before this went into the migration (see the module's docs).
  with recursive edges as (
    select elem->>'source' as source, elem->>'target' as target
    from jsonb_array_elements(v_graph->'edges') as elem
  ),
  reachable as (
    select source as start_node, target as reached from edges
    union
    select r.start_node, e.target
    from reachable r
    join edges e on e.source = r.reached
  )
  select exists (select 1 from reachable where start_node = reached) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Workflow graph must not contain a cycle';
  end if;

  return new;
end;
$$;

-- ============================================================
-- TABLES
-- ============================================================

create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  category text not null check (category in ('movie', 'trailer', 'commercial', 'music_video', 'animation')),
  graph jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  graph jsonb not null,
  source_template_id uuid references public.workflow_templates (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  status public.render_job_status not null default 'queued',
  input_params jsonb not null default '{}'::jsonb,
  output_asset_url text,
  error_message text,
  progress numeric(5, 2) check (progress between 0 and 100),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index workflows_project_id_idx on public.workflows (project_id);
create index render_jobs_project_id_idx on public.render_jobs (project_id, created_at desc);
create index render_jobs_status_idx on public.render_jobs (status);

create trigger validate_graph before insert or update of graph on public.workflow_templates
  for each row execute function public.validate_workflow_graph();
create trigger validate_graph before insert or update of graph on public.workflows
  for each row execute function public.validate_workflow_graph();

create trigger set_updated_at before update on public.workflow_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workflows
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.render_jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- audit_log_trigger gains workflow_templates as a third platform-level
-- table; workflows/render_jobs fit the existing project_id branch as-is.
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
  elsif tg_table_name in ('ai_models', 'routing_rules', 'workflow_templates') then
    v_org_id := null;
    v_target_id := coalesce(new.id, old.id)::text;
  else
    -- project-scoped tables (characters, locations, character_relationships,
    -- timeline_events, story_bible_notes, scripts, workflows, render_jobs,
    -- and any future one with a plain project_id column): resolve org_id
    -- via the parent project.
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

create trigger audit_workflow_templates after insert or update or delete on public.workflow_templates
  for each row execute function public.audit_log_trigger();
create trigger audit_workflows after insert or update or delete on public.workflows
  for each row execute function public.audit_log_trigger();
create trigger audit_render_jobs after insert or update or delete on public.render_jobs
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS
-- ============================================================

alter table public.workflow_templates enable row level security;
alter table public.workflows enable row level security;
alter table public.render_jobs enable row level security;

grant select on public.workflow_templates to authenticated;
grant insert, update, delete on public.workflow_templates to authenticated;

create policy "workflow_templates_select_all" on public.workflow_templates for select
  to authenticated using (true);
create policy "workflow_templates_insert_platform_admin" on public.workflow_templates for insert
  to authenticated with check (public.is_platform_admin());
create policy "workflow_templates_update_platform_admin" on public.workflow_templates for update
  to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "workflow_templates_delete_platform_admin" on public.workflow_templates for delete
  to authenticated using (public.is_platform_admin());

-- workflows and render_jobs: collaborative, same shape as scripts
-- (Module 5) — any project member reads/writes, not just the creator.

grant select, insert, update, delete on public.workflows to authenticated;

create policy "workflows_select" on public.workflows for select
  to authenticated using (public.is_project_member(project_id));
create policy "workflows_insert" on public.workflows for insert
  to authenticated with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "workflows_update" on public.workflows for update
  to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "workflows_delete" on public.workflows for delete
  to authenticated using (public.is_project_member(project_id));

-- render_jobs is append-mostly history, like audit_logs: no delete grant
-- at all, so a job can be cancelled (an update) but never erased.
grant select, insert, update on public.render_jobs to authenticated;

create policy "render_jobs_select" on public.render_jobs for select
  to authenticated using (public.is_project_member(project_id));
create policy "render_jobs_insert" on public.render_jobs for insert
  to authenticated with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "render_jobs_update" on public.render_jobs for update
  to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

-- ============================================================
-- Realtime: render_jobs status changes stream to the frontend without
-- polling. Supabase's realtime publication is additive — this doesn't
-- touch any other table's replication status.
-- ============================================================

alter publication supabase_realtime add table public.render_jobs;

-- ============================================================
-- Seed the five workflow templates the product brief names. Each is a
-- minimal, real, valid graph (passes validate_workflow_graph) — not a
-- placeholder — demonstrating the input -> model_task -> output shape a
-- user would customize from.
-- ============================================================

insert into public.workflow_templates (slug, name, description, category, graph) values
  (
    'movie-starter',
    'Movie',
    'A minimal starting point for a full-length narrative piece.',
    'movie',
    '{
      "nodes": [
        {"id": "script", "type": "input", "label": "Script", "position": {"x": 0, "y": 0}, "config": {"key": "script"}},
        {"id": "generate", "type": "model_task", "label": "Generate Video", "position": {"x": 260, "y": 0}, "config": {"taskType": "movie", "params": {}}},
        {"id": "output", "type": "output", "label": "Movie", "position": {"x": 520, "y": 0}, "config": {"key": "video"}}
      ],
      "edges": [
        {"id": "e1", "source": "script", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "output"}
      ]
    }'::jsonb
  ),
  (
    'trailer-starter',
    'Trailer',
    'Fast-draft pacing suited to a short promotional cut.',
    'trailer',
    '{
      "nodes": [
        {"id": "script", "type": "input", "label": "Script", "position": {"x": 0, "y": 0}, "config": {"key": "script"}},
        {"id": "generate", "type": "model_task", "label": "Generate Draft", "position": {"x": 260, "y": 0}, "config": {"taskType": "fast_draft", "params": {}}},
        {"id": "output", "type": "output", "label": "Trailer", "position": {"x": 520, "y": 0}, "config": {"key": "video"}}
      ],
      "edges": [
        {"id": "e1", "source": "script", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "output"}
      ]
    }'::jsonb
  ),
  (
    'commercial-starter',
    'Commercial',
    'Short-form, image-to-video-friendly starting point for ads.',
    'commercial',
    '{
      "nodes": [
        {"id": "image", "type": "input", "label": "Product Image", "position": {"x": 0, "y": 0}, "config": {"key": "image"}},
        {"id": "generate", "type": "model_task", "label": "Animate", "position": {"x": 260, "y": 0}, "config": {"taskType": "image_to_video", "params": {}}},
        {"id": "output", "type": "output", "label": "Commercial", "position": {"x": 520, "y": 0}, "config": {"key": "video"}}
      ],
      "edges": [
        {"id": "e1", "source": "image", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "output"}
      ]
    }'::jsonb
  ),
  (
    'music-video-starter',
    'Music Video',
    'Character-consistency-focused starting point for a music video.',
    'music_video',
    '{
      "nodes": [
        {"id": "script", "type": "input", "label": "Concept", "position": {"x": 0, "y": 0}, "config": {"key": "script"}},
        {"id": "generate", "type": "model_task", "label": "Generate Video", "position": {"x": 260, "y": 0}, "config": {"taskType": "character_consistency", "params": {}}},
        {"id": "output", "type": "output", "label": "Music Video", "position": {"x": 520, "y": 0}, "config": {"key": "video"}}
      ],
      "edges": [
        {"id": "e1", "source": "script", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "output"}
      ]
    }'::jsonb
  ),
  (
    'animation-starter',
    'Animation',
    'Long-form narrative starting point for animated pieces.',
    'animation',
    '{
      "nodes": [
        {"id": "script", "type": "input", "label": "Script", "position": {"x": 0, "y": 0}, "config": {"key": "script"}},
        {"id": "generate", "type": "model_task", "label": "Generate Video", "position": {"x": 260, "y": 0}, "config": {"taskType": "long_story", "params": {}}},
        {"id": "output", "type": "output", "label": "Animation", "position": {"x": 520, "y": 0}, "config": {"key": "video"}}
      ],
      "edges": [
        {"id": "e1", "source": "script", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "output"}
      ]
    }'::jsonb
  );
