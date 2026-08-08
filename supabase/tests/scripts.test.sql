-- Script Studio (Module 5) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from rls.test.sql/story_bible.test.sql
-- (different user ids) since all test files run against the same
-- database in one run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000007', 'grace@example.com', '{"full_name":"Grace"}'),
  ('00000000-0000-0000-0000-000000000008', 'heidi@example.com', '{"full_name":"Heidi"}'),
  ('00000000-0000-0000-0000-000000000009', 'ivan@example.com', '{"full_name":"Ivan"}');

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000007'); -- grace

insert into test_context (key, value)
select 'script_org_id', (public.create_organization('Script Co', 'script-co')).id::text;

select public.add_organization_member(test_ctx('script_org_id')::uuid, '00000000-0000-0000-0000-000000000008', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('script_org_id')::uuid, 'Feature Film')
  returning id
)
insert into test_context (key, value)
select 'script_project_id', id::text from inserted;

with inserted as (
  insert into public.scripts (project_id, title, content)
  values (test_ctx('script_project_id')::uuid, 'Pilot Draft 1', 'FADE IN: A quiet town.')
  returning id
)
insert into test_context (key, value)
select 'script_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a script',
    (select title from public.scripts where id = test_ctx('script_id')::uuid) = 'Pilot Draft 1'
  );

  perform test_assert(
    'a new script defaults to draft status',
    (select status from public.scripts where id = test_ctx('script_id')::uuid) = 'draft'
  );

  perform test_assert(
    'creating a script writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'scripts'
        and target_id = test_ctx('script_id')
        and action = 'scripts.insert'
        and org_id = test_ctx('script_org_id')::uuid
    )
  );

  begin
    insert into public.scripts (project_id, title, created_by)
    values (test_ctx('script_project_id')::uuid, 'Spoofed', '00000000-0000-0000-0000-000000000008');
    perform test_assert('cannot create a script with created_by set to someone else', false);
  exception when others then
    perform test_assert('cannot create a script with created_by set to someone else', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- heidi (plain member) — collaborative read/write/delete, matching the
-- Story Bible tables' RBAC model, not the stricter Projects one
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000008'); -- heidi

do $$
begin
  perform test_assert(
    'a plain project member can see scripts in their project',
    (select count(*) from public.scripts where id = test_ctx('script_id')::uuid) = 1
  );
end $$;

update public.scripts
set content = 'FADE IN: A quiet town, until it isn''t.', status = 'final'
where id = test_ctx('script_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can edit script content and status',
    (
      select status from public.scripts where id = test_ctx('script_id')::uuid
    ) = 'final'
  );
end $$;

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000007'); -- grace, owner — audit_logs reads are owner/admin-only

do $$
begin
  perform test_assert(
    'editing a script writes an audit_logs row capturing old and new content',
    exists (
      select 1 from public.audit_logs
      where target_type = 'scripts'
        and target_id = test_ctx('script_id')
        and action = 'scripts.update'
        and metadata -> 'old' ->> 'content' = 'FADE IN: A quiet town.'
        and metadata -> 'new' ->> 'content' = 'FADE IN: A quiet town, until it isn''t.'
    )
  );
end $$;

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000008'); -- back to heidi

with inserted as (
  insert into public.scripts (project_id, title)
  values (test_ctx('script_project_id')::uuid, 'Throwaway outline')
  returning id
)
insert into test_context (key, value)
select 'script_throwaway_id', id::text from inserted;

delete from public.scripts where id = test_ctx('script_throwaway_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can delete a script — collaborative, like the Story Bible tables',
    (select count(*) from public.scripts where id = test_ctx('script_throwaway_id')::uuid) = 0
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000009'); -- ivan, not in script-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its scripts',
    (select count(*) from public.scripts where project_id = test_ctx('script_project_id')::uuid) = 0
  );

  begin
    insert into public.scripts (project_id, title)
    values (test_ctx('script_project_id')::uuid, 'Trespass script');
    perform test_assert('a user outside the org cannot create scripts for it', false);
  exception when others then
    perform test_assert('a user outside the org cannot create scripts for it', true);
  end;
end $$;

reset role;
select public.clear_local_actor();
