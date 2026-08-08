-- Module 3: Projects & Dashboard Shell.
-- Projects are the container every future creative module (Script Studio,
-- Storyboard Studio, ...) attaches to. Unlike organizations/memberships,
-- there's no multi-step invariant to protect, so this table uses plain
-- RLS-gated client INSERT/UPDATE/DELETE rather than a SECURITY DEFINER
-- RPC — the pattern established in Module 2 was "use an RPC when atomicity
-- or privilege composition demands it," not "always use an RPC."

create type public.project_status as enum ('draft', 'in_progress', 'completed', 'archived');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  status public.project_status not null default 'draft',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_org_id_created_at_idx on public.projects (org_id, created_at desc);

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ============================================================
-- Generalize the Module 2 audit trigger to cover any org-scoped table
-- that has its own `id` column (projects is the first; organization_members
-- has no `id` column, hence the dedicated branch), and to also cover
-- INSERT — Module 2's org/membership INSERTs were logged explicitly by
-- the create_organization/add_organization_member RPCs instead, but
-- projects has no RPC wrapping its INSERT, so the generic trigger must
-- cover all three operations here.
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
  else
    -- Generic case: any table with (id, org_id) columns.
    v_org_id := coalesce(new.org_id, old.org_id);
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

create trigger audit_projects
  after insert or update or delete on public.projects
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RLS
-- ============================================================

alter table public.projects enable row level security;

grant select, insert, update, delete on public.projects to authenticated;

create policy "projects_select_org_members"
  on public.projects for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "projects_insert_org_members"
  on public.projects for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "projects_update_org_members"
  on public.projects for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "projects_delete_creator_or_admin"
  on public.projects for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.has_org_role(org_id, array['owner', 'admin']::public.organization_role[])
  );
