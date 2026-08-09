-- Module 16: Admin Dashboard & Ops. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids), since all test files run against the same database in one
-- run_tests.sh invocation.
--
-- What this proves: the new is_platform_admin() SELECT policies added by
-- 20260809175302_admin_dashboard_ops.sql actually let a platform admin
-- read organizations/organization_members/profiles/projects/render_jobs/
-- export_jobs/ai_suggestions rows they are not a member of — and, just as
-- important, that a non-admin outsider still cannot (the additive policy
-- must not have accidentally widened anyone else's access), and that the
-- new policy is SELECT-only (a platform admin still cannot write to an
-- org they don't belong to).

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000035', 'milo@example.com', '{"full_name":"Milo"}'),
  ('00000000-0000-0000-0000-000000000036', 'nadia@example.com', '{"full_name":"Nadia"}'),
  ('00000000-0000-0000-0000-000000000037', 'otis@example.com', '{"full_name":"Otis"}');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000035';

-- ============================================================
-- Fixtures: nadia owns an org/project/workflow/render job/timeline/
-- export job/suggestion that neither milo nor otis belongs to.
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000036'); -- nadia

insert into test_context (key, value)
select 'ado_org_id', (public.create_organization('Admin Ops Co', 'admin-ops-co')).id::text;

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('ado_org_id')::uuid, 'Ops Test Project')
  returning id
)
insert into test_context (key, value)
select 'ado_project_id', id::text from inserted;

with inserted as (
  insert into public.workflows (project_id, name, graph)
  values (
    test_ctx('ado_project_id')::uuid,
    'Ops Test Workflow',
    '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb
  )
  returning id
)
insert into test_context (key, value)
select 'ado_workflow_id', id::text from inserted;

with inserted as (
  insert into public.render_jobs (project_id, workflow_id)
  values (test_ctx('ado_project_id')::uuid, test_ctx('ado_workflow_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'ado_render_job_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('ado_project_id')::uuid, 'Ops Test Timeline')
  returning id
)
insert into test_context (key, value)
select 'ado_timeline_id', id::text from inserted;

with inserted as (
  insert into public.export_jobs (timeline_id)
  values (test_ctx('ado_timeline_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'ado_export_job_id', id::text from inserted;

with inserted as (
  insert into public.ai_suggestions (project_id, role, prompt)
  values (test_ctx('ado_project_id')::uuid, 'producer', 'Budget check for the ops test project.')
  returning id
)
insert into test_context (key, value)
select 'ado_suggestion_id', id::text from inserted;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Regression: a non-admin outsider still cannot see any of it.
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000037'); -- otis, outsider, not a platform admin

do $$
begin
  perform test_assert(
    'a non-admin outsider cannot see the organization',
    (select count(*) from public.organizations where id = test_ctx('ado_org_id')::uuid) = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the organization membership',
    (select count(*) from public.organization_members where org_id = test_ctx('ado_org_id')::uuid) = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the owner''s profile',
    (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000036') = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the project',
    (select count(*) from public.projects where id = test_ctx('ado_project_id')::uuid) = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the render job',
    (select count(*) from public.render_jobs where id = test_ctx('ado_render_job_id')::uuid) = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the export job',
    (select count(*) from public.export_jobs where id = test_ctx('ado_export_job_id')::uuid) = 0
  );
  perform test_assert(
    'a non-admin outsider cannot see the AI suggestion',
    (select count(*) from public.ai_suggestions where id = test_ctx('ado_suggestion_id')::uuid) = 0
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- A platform admin, not a member of this org at all, can see all of it.
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000035'); -- milo, platform admin

do $$
begin
  perform test_assert(
    'a platform admin can see an organization they are not a member of',
    (select count(*) from public.organizations where id = test_ctx('ado_org_id')::uuid) = 1
  );
  perform test_assert(
    'a platform admin can see organization membership rows across orgs',
    (select count(*) from public.organization_members where org_id = test_ctx('ado_org_id')::uuid) = 1
  );
  perform test_assert(
    'a platform admin can see any user''s profile',
    (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000036') = 1
  );
  perform test_assert(
    'a platform admin can see a project outside their org',
    (select count(*) from public.projects where id = test_ctx('ado_project_id')::uuid) = 1
  );
  perform test_assert(
    'a platform admin can see a render job outside their org',
    (select count(*) from public.render_jobs where id = test_ctx('ado_render_job_id')::uuid) = 1
  );
  perform test_assert(
    'a platform admin can see an export job outside their org',
    (select count(*) from public.export_jobs where id = test_ctx('ado_export_job_id')::uuid) = 1
  );
  perform test_assert(
    'a platform admin can see an AI suggestion outside their org',
    (select count(*) from public.ai_suggestions where id = test_ctx('ado_suggestion_id')::uuid) = 1
  );
end $$;

-- The new policies are additive SELECT grants only — a platform admin
-- still cannot write to an org they don't belong to; is_platform_admin()
-- was never added to any UPDATE/INSERT/DELETE policy on these tables.
update public.organizations set name = 'Hijacked by Milo' where id = test_ctx('ado_org_id')::uuid;

do $$
begin
  perform test_assert(
    'read-only visibility does not imply write access: a platform admin cannot rename an org they do not belong to',
    (select name from public.organizations where id = test_ctx('ado_org_id')::uuid) = 'Admin Ops Co'
  );
end $$;

reset role;
select public.clear_local_actor();
