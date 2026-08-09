-- Module 7: AI Router.
--
-- "Users never choose models unless they enable Advanced Mode. The router
-- automatically selects the best model." — implemented as a data-driven
-- routing_rules table (task_type -> an ordered fallback chain of model
-- slugs) rather than hardcoded logic, so a platform admin can retune
-- routing without a deploy, the same reasoning that made ai_models a
-- table instead of a hardcoded model list in Module 6.
--
-- Seeded with exactly the six task types the product brief names
-- (Movie/Character Consistency/Human Acting/Image to Video/Long
-- Story/Fast Draft), all video-category. Task types for other
-- categories (image/audio/voice/llm) are added the same way, by a real
-- Studio module that needs them — not speculatively here.

create table public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  task_type text not null unique check (task_type ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  category public.ai_model_category not null,
  description text,
  -- Ordered fallback chain: the router tries these in order and picks the
  -- first one that's actually installed and enabled.
  preferred_model_slugs text[] not null check (array_length(preferred_model_slugs, 1) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.routing_rules is 'Task type -> ordered model preference. Read by select_model_for_task(). Not org/project-scoped — routing policy is platform-wide, like the model registry it points into.';

-- ============================================================
-- Referential integrity for the slug array: Postgres has no array FK, so
-- this is enforced with a trigger instead, the same approach as Module 4's
-- cross-project relationship guard.
-- ============================================================

create or replace function public.validate_routing_rule_slugs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text;
begin
  select slug into v_missing
  from unnest(new.preferred_model_slugs) as slug
  where slug not in (select ai_models.slug from public.ai_models)
  limit 1;

  if v_missing is not null then
    raise exception 'Unknown model slug in preferred_model_slugs: %', v_missing;
  end if;

  return new;
end;
$$;

create trigger validate_routing_rule_slugs
  before insert or update of preferred_model_slugs on public.routing_rules
  for each row execute function public.validate_routing_rule_slugs();

create trigger set_updated_at
  before update on public.routing_rules
  for each row execute function public.set_updated_at();

-- ============================================================
-- audit_log_trigger gains routing_rules as a second platform-level
-- (org_id-null) table, alongside ai_models from Module 6.
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
  elsif tg_table_name in ('ai_models', 'routing_rules') then
    v_org_id := null;
    v_target_id := coalesce(new.id, old.id)::text;
  else
    -- project-scoped tables (characters, locations, character_relationships,
    -- timeline_events, story_bible_notes, scripts, and any future one with a
    -- plain project_id column): resolve org_id via the parent project.
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

create trigger audit_routing_rules
  after insert or update or delete on public.routing_rules
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS: same shape as ai_models — everyone reads, platform admins write.
-- ============================================================

alter table public.routing_rules enable row level security;

grant select on public.routing_rules to authenticated;
grant insert, update, delete on public.routing_rules to authenticated;

create policy "routing_rules_select_all" on public.routing_rules for select
  to authenticated
  using (true);

create policy "routing_rules_insert_platform_admin" on public.routing_rules for insert
  to authenticated
  with check (public.is_platform_admin());

create policy "routing_rules_update_platform_admin" on public.routing_rules for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "routing_rules_delete_platform_admin" on public.routing_rules for delete
  to authenticated
  using (public.is_platform_admin());

-- ============================================================
-- The router itself. Returns an ai_models row; when nothing eligible is
-- found, every column is null (Postgres composite-null semantics for a
-- `select ... into` that matched no rows) — callers check `(result).id
-- is null`, not `result is null`. Read-only, no elevated privileges
-- needed: it only reads tables already SELECT-open to every authenticated
-- user.
-- ============================================================

create or replace function public.select_model_for_task(
  p_task_type text,
  p_override_slug text default null
)
returns public.ai_models
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rule public.routing_rules;
  v_model public.ai_models;
  v_slug text;
begin
  -- Advanced Mode: the caller picked a specific model. Still constrained
  -- to models that are actually installed and enabled — Advanced Mode
  -- lets a user pick *which* eligible model, not bypass eligibility.
  if p_override_slug is not null then
    select * into v_model from public.ai_models
    where slug = p_override_slug and is_enabled = true and install_status = 'installed';
    return v_model;
  end if;

  select * into v_rule from public.routing_rules where task_type = p_task_type;
  if v_rule.id is null then
    return v_model; -- all-null row: unknown task_type
  end if;

  foreach v_slug in array v_rule.preferred_model_slugs
  loop
    select * into v_model from public.ai_models
    where slug = v_slug and is_enabled = true and install_status = 'installed';
    if v_model.id is not null then
      return v_model;
    end if;
  end loop;

  -- Nothing in the preferred chain is installed — fall back to any
  -- installed+enabled model in the same category, oldest first (a real
  -- benchmark-based ranking is future work, once Module 6's deferred
  -- benchmark feature produces data worth ranking on). `slug` is a
  -- deterministic tiebreaker: bulk-seeded rows share one INSERT
  -- statement's `now()`, so created_at alone doesn't reliably order them.
  select * into v_model from public.ai_models
  where category = v_rule.category and is_enabled = true and install_status = 'installed'
  order by created_at, slug
  limit 1;

  return v_model;
end;
$$;

revoke execute on function public.select_model_for_task(text, text) from public;
grant execute on function public.select_model_for_task(text, text) to authenticated;

-- ============================================================
-- Seed the six task types from the product brief.
-- ============================================================

insert into public.routing_rules (task_type, category, description, preferred_model_slugs) values
  ('movie', 'video', 'General movie/scene generation.', array['wan-2-2', 'open-sora', 'hunyuan-video']),
  ('character_consistency', 'video', 'Scenes where the same character must look consistent across shots.', array['skyreels-v2', 'wan-2-2']),
  ('human_acting', 'video', 'Scenes emphasizing realistic human performance/motion.', array['hunyuan-video', 'wan-2-2']),
  ('image_to_video', 'video', 'Animating a still image into video.', array['cogvideox', 'stable-video-diffusion']),
  ('long_story', 'video', 'Long-form narrative sequences.', array['open-sora', 'wan-2-2']),
  ('fast_draft', 'video', 'Quick low-fidelity previews.', array['ltx-video']);
