-- Module 2: Auth & Multi-Tenant Core Schema.
-- Every table is multi-tenant (org-scoped) and RLS-protected from creation.
-- Direct client INSERT is intentionally not granted on organizations,
-- organization_members, or audit_logs — those only change via the
-- SECURITY DEFINER functions below, so the org/owner-membership/audit-trail
-- invariants can never be created in a partial or inconsistent state.

create type public.organization_role as enum ('owner', 'admin', 'member');

-- ============================================================
-- TABLES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth.users, created automatically by handle_new_user().';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only. No client INSERT/UPDATE/DELETE grants exist — rows are written only by SECURITY DEFINER functions/triggers.';

create index audit_logs_org_id_created_at_idx on public.audit_logs (org_id, created_at desc);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- ============================================================
-- updated_at triggers (function defined in the Module 1 baseline migration)
-- ============================================================

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RBAC helper functions.
--
-- SECURITY DEFINER + a fixed empty search_path is required here: these
-- helpers are called from *within* RLS policies on organization_members
-- itself, and a plain (invoker-rights) function would re-trigger RLS on
-- that same select, recursing. Running as definer bypasses RLS only
-- inside this function's own body, which does nothing but read
-- membership rows scoped to auth.uid() — it does not widen what the
-- caller can otherwise see.
-- ============================================================

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = auth.uid() and role = any (p_roles)
  );
$$;

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

-- ============================================================
-- Guard: an organization can never end up with zero owners.
-- ============================================================

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_owners int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into remaining_owners
    from public.organization_members
    where org_id = old.org_id and role = 'owner' and user_id <> old.user_id;

    if remaining_owners = 0 then
      raise exception 'Cannot remove the last owner of an organization';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guard_last_owner
  before update or delete on public.organization_members
  for each row execute function public.prevent_last_owner_removal();

-- ============================================================
-- Automatic audit trail for org/membership changes.
-- INSERTs are logged explicitly (with richer metadata) by the RPCs below,
-- so this generic trigger only covers UPDATE/DELETE.
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
begin
  if tg_table_name = 'organizations' then
    v_org_id := coalesce(new.id, old.id);
    v_target_id := coalesce(new.id, old.id)::text;
  else
    v_org_id := coalesce(new.org_id, old.org_id);
    v_target_id := coalesce(new.user_id, old.user_id)::text;
  end if;

  insert into public.audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_target_id,
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_organizations
  after update or delete on public.organizations
  for each row execute function public.audit_log_trigger();

create trigger audit_organization_members
  after update or delete on public.organization_members
  for each row execute function public.audit_log_trigger();

-- ============================================================
-- RPCs: the only way organizations/memberships are created.
-- ============================================================

create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.organizations (name, slug, owner_id)
  values (p_name, p_slug, auth.uid())
  returning * into v_org;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  insert into public.audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org.id,
    auth.uid(),
    'organization.created',
    'organization',
    v_org.id::text,
    jsonb_build_object('name', p_name, 'slug', p_slug)
  );

  return v_org;
end;
$$;

comment on function public.create_organization(text, text) is
  'Atomically creates an organization and its owner membership. The only sanctioned way to create an organization.';

create or replace function public.add_organization_member(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.organization_role default 'member'
)
returns public.organization_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members;
begin
  if not public.has_org_role(p_org_id, array['owner', 'admin']::public.organization_role[]) then
    raise exception 'Only organization owners/admins can add members';
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (p_org_id, p_user_id, p_role)
  returning * into v_member;

  insert into public.audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  values (p_org_id, auth.uid(), 'member.added', 'organization_member', p_user_id::text, jsonb_build_object('role', p_role));

  return v_member;
end;
$$;

comment on function public.add_organization_member(uuid, uuid, public.organization_role) is
  'Adds an existing user to an organization. Caller must already be owner/admin. Full email-invite flow is a later module.';

revoke execute on function public.create_organization(text, text) from public;
revoke execute on function public.add_organization_member(uuid, uuid, public.organization_role) from public;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.add_organization_member(uuid, uuid, public.organization_role) to authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_logs enable row level security;

-- Supabase's current default no longer auto-exposes new tables to
-- anon/authenticated (see supabase/config.toml, [api] section) — grants
-- must be explicit. anon gets nothing on any of these tables.

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, update, delete on public.organization_members to authenticated;
grant select on public.audit_logs to authenticated;

create policy "profiles_select_self_or_org_peer"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members m1
      join public.organization_members m2 on m1.org_id = m2.org_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "organizations_select_members"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "organizations_update_admins"
  on public.organizations for update
  to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.organization_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.organization_role[]));

create policy "org_members_select_peers"
  on public.organization_members for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "org_members_update_admins"
  on public.organization_members for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.organization_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.organization_role[]));

create policy "org_members_delete_admins_or_self"
  on public.organization_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_role(org_id, array['owner', 'admin']::public.organization_role[])
  );

create policy "audit_logs_select_admins"
  on public.audit_logs for select
  to authenticated
  using (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.organization_role[]));
