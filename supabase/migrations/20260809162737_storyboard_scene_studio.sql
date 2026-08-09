-- Module 10: Storyboard & Scene Studio.
--
-- "Visual scene planning, depends on Script Studio output + Character/
-- Environment studios." Scene Studio organizes a project into scenes
-- (optionally tied to a script and a location); Storyboard Studio breaks
-- each scene into an ordered sequence of shots, each of which can tag the
-- characters appearing in it and — reusing Module 9's workflow-linking
-- pattern rather than inventing a second one — generate a storyboard
-- frame image through the exact same graph/compiler/queue/dispatch
-- pipeline Module 8 built.

-- Postgres requires a new enum value to be committed before it can be
-- used (by a DML literal, or by a function body that references it) —
-- this must be the first statement in the file, and every later
-- statement in this same file runs as its own auto-committed
-- transaction under plain `psql -f` execution (verified directly before
-- writing this migration), so 'shot' is safely usable below.
alter type public.workflow_subject_type add value 'shot';

-- ============================================================
-- scenes: project-scoped, optionally anchored to a script and a location.
-- Both references are validated (not just FK-checked) to belong to the
-- same project, the same guard shape as Module 4's character_relationships
-- and Module 9's workflow subject linkage.
-- ============================================================

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  script_id uuid references public.scripts (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  scene_order integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_scene_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.script_id is not null and not exists (
    select 1 from public.scripts where id = new.script_id and project_id = new.project_id
  ) then
    raise exception 'script_id must belong to the same project as the scene';
  end if;

  if new.location_id is not null and not exists (
    select 1 from public.locations where id = new.location_id and project_id = new.project_id
  ) then
    raise exception 'location_id must belong to the same project as the scene';
  end if;

  return new;
end;
$$;

create trigger validate_scene_refs
  before insert or update of script_id, location_id, project_id on public.scenes
  for each row execute function public.validate_scene_refs();

-- ============================================================
-- shots: belong to a scene. project_id is trigger-populated from the
-- scene (never client-supplied) — the same "derived, not trusted" shape
-- as Module 4's character_relationships.project_id.
-- ============================================================

create table public.shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  shot_order integer not null default 0,
  shot_type text,
  description text not null check (char_length(description) between 1 and 2000),
  duration_seconds numeric(6, 2) check (duration_seconds is null or duration_seconds > 0),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_shot_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id from public.scenes where id = new.scene_id;

  if v_project_id is null then
    raise exception 'scene_id must reference an existing scene';
  end if;

  new.project_id := v_project_id;
  return new;
end;
$$;

create trigger set_shot_project
  before insert or update of scene_id on public.shots
  for each row execute function public.set_shot_project();

-- ============================================================
-- shot_characters: which characters appear in a shot. project_id is
-- trigger-populated and cross-validated against both sides, the same
-- pattern as Module 4's set_relationship_project.
-- ============================================================

create table public.shot_characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  shot_id uuid not null references public.shots (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (shot_id, character_id)
);

create or replace function public.set_shot_character_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shot_project uuid;
  v_char_project uuid;
begin
  select project_id into v_shot_project from public.shots where id = new.shot_id;
  select project_id into v_char_project from public.characters where id = new.character_id;

  if v_shot_project is null or v_char_project is null then
    raise exception 'shot_id and character_id must reference existing rows';
  end if;

  if v_shot_project is distinct from v_char_project then
    raise exception 'A shot can only be tagged with characters from the same project';
  end if;

  new.project_id := v_shot_project;
  return new;
end;
$$;

create trigger set_shot_character_project
  before insert or update of shot_id, character_id on public.shot_characters
  for each row execute function public.set_shot_character_project();

-- ============================================================
-- Indexes, updated_at, audit triggers. All three tables have a plain
-- project_id column (client-supplied on scenes, trigger-derived on the
-- other two) so audit_log_trigger's existing generic branch already
-- covers them — no changes needed there, same as shot_characters'
-- sibling character_relationships needed none in Module 4.
-- ============================================================

create index scenes_project_id_order_idx on public.scenes (project_id, scene_order);
create index scenes_script_id_idx on public.scenes (script_id);
create index shots_scene_id_order_idx on public.shots (scene_id, shot_order);
create index shot_characters_shot_id_idx on public.shot_characters (shot_id);
create index shot_characters_character_id_idx on public.shot_characters (character_id);

do $$
declare
  t text;
begin
  foreach t in array array['scenes', 'shots']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;

  foreach t in array array['scenes', 'shots', 'shot_characters']
  loop
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_log_trigger()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- RLS: collaborative, same shape as characters/locations/props — any
-- project member reads/writes/deletes.
-- ============================================================

alter table public.scenes enable row level security;
alter table public.shots enable row level security;
alter table public.shot_characters enable row level security;

grant select, insert, update, delete on public.scenes to authenticated;
grant select, insert, update, delete on public.shots to authenticated;
grant select, insert, update, delete on public.shot_characters to authenticated;

create policy "scenes_select" on public.scenes for select to authenticated
  using (public.is_project_member(project_id));
create policy "scenes_insert" on public.scenes for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "scenes_update" on public.scenes for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "scenes_delete" on public.scenes for delete to authenticated
  using (public.is_project_member(project_id));

-- project_id is trigger-set on shots (see set_shot_project), so, as with
-- Module 4's character_relationships, the WITH CHECK still evaluates
-- is_project_member(project_id) — just against the trigger-populated
-- value, since BEFORE ROW triggers run before WITH CHECK is evaluated.
create policy "shots_select" on public.shots for select to authenticated
  using (public.is_project_member(project_id));
create policy "shots_insert" on public.shots for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "shots_update" on public.shots for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "shots_delete" on public.shots for delete to authenticated
  using (public.is_project_member(project_id));

create policy "shot_characters_select" on public.shot_characters for select to authenticated
  using (public.is_project_member(project_id));
create policy "shot_characters_insert" on public.shot_characters for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "shot_characters_delete" on public.shot_characters for delete to authenticated
  using (public.is_project_member(project_id));

-- ============================================================
-- Storyboard frame generation reuses Module 9's workflow-subject
-- linking rather than a third generation path: a shot is just another
-- subject type. validate_workflow_subject() gains a fourth branch
-- (character/location/prop already existed from Module 9).
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
  else
    select exists (
      select 1 from public.shots where id = new.subject_id and project_id = new.project_id
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'subject_id must reference an existing % in the same project', new.subject_type;
  end if;

  return new;
end;
$$;

insert into public.routing_rules (task_type, category, description, preferred_model_slugs) values
  ('storyboard_frame', 'image', 'Rough visual for a single storyboard shot.', array['flux', 'sdxl']);
