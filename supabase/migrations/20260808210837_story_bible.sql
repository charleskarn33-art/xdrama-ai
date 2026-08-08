-- Module 4: Story Bible — the consistency backbone every creative studio
-- (Script, Storyboard, Character, Environment Studios, ...) reads from and
-- writes to. Scoped to a project (not the whole org): a character or
-- location belongs to one movie's story bible. Cross-project/franchise
-- reuse ("Universe Memory" spanning multiple projects) is a deliberately
-- deferred enhancement, not modeled here.
--
-- RBAC differs slightly from Module 3's projects table on purpose: any
-- project member can also DELETE story bible entries (not just the
-- creator/owner/admin). These are working creative documents edited
-- collaboratively — losing a character sheet is not the same magnitude of
-- mistake as losing the project container itself, which is why projects
-- kept the stricter rule and these don't.

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and public.is_org_member(p.org_id)
  );
$$;

revoke execute on function public.is_project_member(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;

-- ============================================================
-- TABLES
-- ============================================================

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  appearance text,
  personality text,
  voice_description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- project_id is denormalized from character_id (auto-populated by the
-- trigger below), not client-supplied, so RLS/audit can use the same
-- uniform (id, project_id) shape as every other story bible table.
create table public.character_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  character_id uuid not null references public.characters (id) on delete cascade,
  related_character_id uuid not null references public.characters (id) on delete cascade,
  relationship_type text not null check (char_length(relationship_type) between 1 and 100),
  description text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint character_relationships_not_self check (character_id <> related_character_id)
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  in_story_date text,
  event_order integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Universe Memory" / world history / lore that doesn't fit a character,
-- location, or timeline entry — free-form wiki-style notes.
create table public.story_bible_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_project_id_idx on public.characters (project_id);
create index locations_project_id_idx on public.locations (project_id);
create index character_relationships_project_id_idx on public.character_relationships (project_id);
create index character_relationships_character_id_idx on public.character_relationships (character_id);
create index character_relationships_related_character_id_idx on public.character_relationships (related_character_id);
create index timeline_events_project_id_order_idx on public.timeline_events (project_id, event_order);
create index story_bible_notes_project_id_idx on public.story_bible_notes (project_id);

-- ============================================================
-- Cross-project integrity guard for relationships, and the trigger that
-- auto-populates project_id so clients never have to pass it.
-- ============================================================

create or replace function public.set_relationship_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_a uuid;
  v_project_b uuid;
begin
  select project_id into v_project_a from public.characters where id = new.character_id;
  select project_id into v_project_b from public.characters where id = new.related_character_id;

  if v_project_a is null or v_project_b is null then
    raise exception 'Both characters must exist';
  end if;

  if v_project_a is distinct from v_project_b then
    raise exception 'Related characters must belong to the same project';
  end if;

  new.project_id := v_project_a;
  return new;
end;
$$;

create trigger set_relationship_project
  before insert or update of character_id, related_character_id on public.character_relationships
  for each row execute function public.set_relationship_project();

-- ============================================================
-- updated_at + audit triggers (reusing Module 1/2/3 functions —
-- audit_log_trigger's generic branch already handles any (id, org_id)
-- table; project-scoped tables need org_id resolved via a join, so it
-- gains one more branch here).
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
  else
    -- project-scoped tables (characters, locations, character_relationships,
    -- timeline_events, story_bible_notes, and any future one with a plain
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

do $$
declare
  t text;
begin
  foreach t in array array['characters', 'locations', 'character_relationships', 'timeline_events', 'story_bible_notes']
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
-- RLS
-- ============================================================

alter table public.characters enable row level security;
alter table public.locations enable row level security;
alter table public.character_relationships enable row level security;
alter table public.timeline_events enable row level security;
alter table public.story_bible_notes enable row level security;

grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.character_relationships to authenticated;
grant select, insert, update, delete on public.timeline_events to authenticated;
grant select, insert, update, delete on public.story_bible_notes to authenticated;

create policy "characters_select" on public.characters for select to authenticated
  using (public.is_project_member(project_id));
create policy "characters_insert" on public.characters for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "characters_update" on public.characters for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "characters_delete" on public.characters for delete to authenticated
  using (public.is_project_member(project_id));

create policy "locations_select" on public.locations for select to authenticated
  using (public.is_project_member(project_id));
create policy "locations_insert" on public.locations for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "locations_update" on public.locations for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "locations_delete" on public.locations for delete to authenticated
  using (public.is_project_member(project_id));

-- project_id is trigger-set (see set_relationship_project), so the INSERT
-- check only needs to gate on the characters, not the pre-trigger value of
-- project_id itself — is_project_member(project_id) still runs, but
-- against the trigger-populated value, since WITH CHECK evaluates after
-- BEFORE ROW triggers.
create policy "character_relationships_select" on public.character_relationships for select to authenticated
  using (public.is_project_member(project_id));
create policy "character_relationships_insert" on public.character_relationships for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "character_relationships_update" on public.character_relationships for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "character_relationships_delete" on public.character_relationships for delete to authenticated
  using (public.is_project_member(project_id));

create policy "timeline_events_select" on public.timeline_events for select to authenticated
  using (public.is_project_member(project_id));
create policy "timeline_events_insert" on public.timeline_events for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "timeline_events_update" on public.timeline_events for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "timeline_events_delete" on public.timeline_events for delete to authenticated
  using (public.is_project_member(project_id));

create policy "story_bible_notes_select" on public.story_bible_notes for select to authenticated
  using (public.is_project_member(project_id));
create policy "story_bible_notes_insert" on public.story_bible_notes for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());
create policy "story_bible_notes_update" on public.story_bible_notes for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy "story_bible_notes_delete" on public.story_bible_notes for delete to authenticated
  using (public.is_project_member(project_id));
