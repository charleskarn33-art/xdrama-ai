-- RLS / RBAC assertions, run against a fresh DB with the local auth stub
-- and all migrations applied. TAP-lite: each assertion prints ok/not ok
-- and records into test_results; the final block fails the whole script
-- (non-zero exit via ON_ERROR_STOP) if anything didn't pass.
--
-- Note: psql's `:'var'` substitution does not reach inside `do $$ ... $$`
-- bodies, so cross-statement values (like the generated org id) are
-- threaded through a real table (test_context) instead of psql variables.

create table test_results (description text, passed boolean);
create table test_context (key text primary key, value text);

-- Test-harness tables only: grant broadly so assertions running as
-- authenticated/anon can read/write them regardless of the RLS/RBAC
-- being exercised on the real application tables.
grant all on test_results, test_context to anon, authenticated, service_role;

create or replace function test_assert(p_description text, p_passed boolean)
returns void
language plpgsql
as $$
begin
  insert into test_results (description, passed) values (p_description, p_passed);
  if p_passed then
    raise notice 'ok - %', p_description;
  else
    raise warning 'not ok - %', p_description;
  end if;
end;
$$;

create or replace function test_ctx(p_key text)
returns text
language sql
stable
as $$
  select value from test_context where key = p_key;
$$;

-- ============================================================
-- Fixtures: three users, created the way GoTrue would (direct insert into
-- auth.users), which fires handle_new_user() to create their profiles.
-- ============================================================

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com', '{"full_name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-000000000003', 'carol@example.com', '{"full_name":"Carol"}');

do $$
begin
  perform test_assert(
    'handle_new_user creates a profile row for each new auth.users row',
    (select count(*) from public.profiles) = 3
  );
end $$;

-- ============================================================
-- create_organization: atomic org + owner membership
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000001');

insert into test_context (key, value)
select 'alice_org_id', (public.create_organization('Alice Inc', 'alice-inc')).id::text;

do $$
begin
  perform test_assert(
    'create_organization makes the caller the owner',
    (
      select role from public.organization_members
      where org_id = test_ctx('alice_org_id')::uuid and user_id = '00000000-0000-0000-0000-000000000001'
    ) = 'owner'
  );

  perform test_assert(
    'create_organization writes an audit_logs row',
    exists (
      select 1 from public.audit_logs
      where org_id = test_ctx('alice_org_id')::uuid and action = 'organization.created'
    )
  );
end $$;

reset role;
select public.clear_local_actor();

do $$
begin
  begin
    set role authenticated;
    perform public.clear_local_actor();
    perform public.create_organization('Anon attempt', 'anon-attempt');
    perform test_assert('unauthenticated create_organization is rejected', false);
  exception when others then
    perform test_assert('unauthenticated create_organization is rejected', true);
  end;
  reset role;
end $$;

-- ============================================================
-- Cross-tenant isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000002');

do $$
begin
  perform test_assert(
    'a non-member cannot see another org via SELECT',
    (select count(*) from public.organizations where id = test_ctx('alice_org_id')::uuid) = 0
  );

  perform test_assert(
    'a non-member cannot see another org peer''s profile',
    (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 0
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- add_organization_member + role-gated updates
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000001');

select public.add_organization_member(test_ctx('alice_org_id')::uuid, '00000000-0000-0000-0000-000000000002', 'member');

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000002');

do $$
begin
  perform test_assert(
    'a newly added member can now see the org',
    (select count(*) from public.organizations where id = test_ctx('alice_org_id')::uuid) = 1
  );
end $$;

update public.organizations set name = 'Hacked by Bob' where id = test_ctx('alice_org_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member cannot update the organization (RLS silently affects 0 rows)',
    (select name from public.organizations where id = test_ctx('alice_org_id')::uuid) = 'Alice Inc'
  );

  begin
    perform public.add_organization_member(test_ctx('alice_org_id')::uuid, '00000000-0000-0000-0000-000000000003', 'member');
    perform test_assert('a plain member cannot add other members', false);
  exception when others then
    perform test_assert('a plain member cannot add other members', true);
  end;
end $$;

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000001');

update public.organizations set name = 'Alice Inc (Renamed)' where id = test_ctx('alice_org_id')::uuid;

do $$
begin
  perform test_assert(
    'the owner can update the organization',
    (select name from public.organizations where id = test_ctx('alice_org_id')::uuid) = 'Alice Inc (Renamed)'
  );
end $$;

-- ============================================================
-- Last-owner guard
-- ============================================================

do $$
begin
  begin
    update public.organization_members
    set role = 'member'
    where org_id = test_ctx('alice_org_id')::uuid and user_id = '00000000-0000-0000-0000-000000000001';
    perform test_assert('the last owner cannot be demoted', false);
  exception when others then
    perform test_assert('the last owner cannot be demoted', true);
  end;
end $$;

select public.add_organization_member(test_ctx('alice_org_id')::uuid, '00000000-0000-0000-0000-000000000003', 'owner');

do $$
begin
  -- with a second owner, alice CAN now step down without error
  update public.organization_members
  set role = 'admin'
  where org_id = test_ctx('alice_org_id')::uuid and user_id = '00000000-0000-0000-0000-000000000001';

  perform test_assert(
    'an owner can be demoted once a second owner exists',
    (
      select role from public.organization_members
      where org_id = test_ctx('alice_org_id')::uuid and user_id = '00000000-0000-0000-0000-000000000001'
    ) = 'admin'
  );
end $$;

-- ============================================================
-- Audit log visibility: owner/admin only
-- ============================================================

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000002');

do $$
begin
  perform test_assert(
    'a plain member cannot read audit_logs for their org',
    (select count(*) from public.audit_logs where org_id = test_ctx('alice_org_id')::uuid) = 0
  );
end $$;

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000001');

do $$
begin
  perform test_assert(
    'an admin/owner can read audit_logs for their org',
    (select count(*) from public.audit_logs where org_id = test_ctx('alice_org_id')::uuid) > 0
  );
end $$;

-- ============================================================
-- profiles_update_self
-- ============================================================

update public.profiles set full_name = 'Alice Updated' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Bob Hacked' where id = '00000000-0000-0000-0000-000000000002';

do $$
begin
  perform test_assert(
    'a user can update their own profile',
    (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 'Alice Updated'
  );

  perform test_assert(
    'a user cannot update another user''s profile',
    (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000002') = 'Bob'
  );
end $$;

-- ============================================================
-- anon has no access at all
-- ============================================================

reset role;
select public.clear_local_actor();

do $$
begin
  begin
    set role anon;
    perform count(*) from public.organizations;
    reset role;
    perform test_assert('anon has no SELECT privilege on organizations', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on organizations', true);
  end;
end $$;

reset role;

-- ============================================================
-- Summary
-- ============================================================

do $$
declare
  v_failed int;
  v_total int;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from test_results;
  raise notice '--- % / % assertions passed ---', v_total - v_failed, v_total;
  if v_failed > 0 then
    raise exception '% assertion(s) failed', v_failed;
  end if;
end $$;
