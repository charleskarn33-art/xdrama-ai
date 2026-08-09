-- AI Workflow Engine (Module 8) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids) since all test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000014', 'noah@example.com', '{"full_name":"Noah"}'),
  ('00000000-0000-0000-0000-000000000015', 'olivia@example.com', '{"full_name":"Olivia"}'),
  ('00000000-0000-0000-0000-000000000016', 'petra@example.com', '{"full_name":"Petra"}');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000014';

do $$
begin
  perform test_assert(
    'the seed migration populated all five workflow templates named in the brief',
    (select array_agg(category order by category) from public.workflow_templates)
      = array['animation', 'commercial', 'movie', 'music_video', 'trailer']
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000015'); -- olivia, not an admin

insert into test_context (key, value)
select 'wf_org_id', (public.create_organization('Workflow Co', 'workflow-co')).id::text;

select public.add_organization_member(test_ctx('wf_org_id')::uuid, '00000000-0000-0000-0000-000000000016', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('wf_org_id')::uuid, 'Feature Film')
  returning id
)
insert into test_context (key, value)
select 'wf_project_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'any authenticated user can read workflow templates',
    (select count(*) from public.workflow_templates) = 5
  );

  begin
    insert into public.workflow_templates (slug, name, category, graph)
    values ('rogue', 'Rogue', 'movie', '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb);
    perform test_assert('a non-admin cannot insert a workflow template', false);
  exception when others then
    perform test_assert('a non-admin cannot insert a workflow template', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- A platform admin actually exercising the write policies below (only
-- the seed migration's superuser inserts, which bypass RLS entirely,
-- had ever gone through workflow_templates' insert/update/delete paths
-- before Module 15 built an admin UI for it) — a real gap in this
-- file's original coverage, closed here rather than assumed.
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000014'); -- noah, platform admin

with inserted as (
  insert into public.workflow_templates (slug, name, category, graph)
  values (
    'admin-test-template',
    'Admin Test Template',
    'movie',
    '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb
  )
  returning id
)
insert into test_context (key, value)
select 'wf_admin_template_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a platform admin can insert a workflow template',
    exists (select 1 from public.workflow_templates where id = test_ctx('wf_admin_template_id')::uuid)
  );
end $$;

update public.workflow_templates set name = 'Renamed by Admin' where id = test_ctx('wf_admin_template_id')::uuid;

do $$
begin
  perform test_assert(
    'a platform admin can update a workflow template',
    (select name from public.workflow_templates where id = test_ctx('wf_admin_template_id')::uuid) = 'Renamed by Admin'
  );
end $$;

delete from public.workflow_templates where id = test_ctx('wf_admin_template_id')::uuid;

do $$
begin
  perform test_assert(
    'a platform admin can delete a workflow template',
    not exists (select 1 from public.workflow_templates where id = test_ctx('wf_admin_template_id')::uuid)
  );
end $$;

reset role;
select public.clear_local_actor();

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000015'); -- olivia, back to not-an-admin

-- clone the movie template into a project-scoped workflow
with inserted as (
  insert into public.workflows (project_id, name, graph, source_template_id)
  select
    test_ctx('wf_project_id')::uuid,
    'My Movie Workflow',
    graph,
    id
  from public.workflow_templates
  where slug = 'movie-starter'
  returning id
)
insert into test_context (key, value)
select 'wf_workflow_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can clone a template into a project workflow',
    exists (select 1 from public.workflows where id = test_ctx('wf_workflow_id')::uuid)
  );

  perform test_assert(
    'creating a workflow writes an audit_logs row scoped to the right org (project_id branch)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'workflows' and target_id = test_ctx('wf_workflow_id') and action = 'workflows.insert'
        and org_id = test_ctx('wf_org_id')::uuid
    )
  );

  begin
    insert into public.workflows (project_id, name, graph)
    values (
      test_ctx('wf_project_id')::uuid,
      'Cyclic',
      '{"nodes":[{"id":"a","type":"input","config":{}},{"id":"b","type":"output","config":{}}],"edges":[{"id":"e1","source":"a","target":"b"},{"id":"e2","source":"b","target":"a"}]}'::jsonb
    );
    perform test_assert('a workflow graph with a cycle is rejected', false);
  exception when others then
    perform test_assert('a workflow graph with a cycle is rejected', true);
  end;

  begin
    insert into public.workflows (project_id, name, graph)
    values (
      test_ctx('wf_project_id')::uuid,
      'Dangling edge',
      '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[{"id":"e1","source":"a","target":"does-not-exist"}]}'::jsonb
    );
    perform test_assert('a workflow graph with a dangling edge reference is rejected', false);
  exception when others then
    perform test_assert('a workflow graph with a dangling edge reference is rejected', true);
  end;
end $$;

with inserted as (
  insert into public.render_jobs (project_id, workflow_id, input_params)
  values (test_ctx('wf_project_id')::uuid, test_ctx('wf_workflow_id')::uuid, '{"script": "FADE IN..."}'::jsonb)
  returning id
)
insert into test_context (key, value)
select 'wf_job_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a render job, defaulting to queued',
    (select status from public.render_jobs where id = test_ctx('wf_job_id')::uuid) = 'queued'
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- petra, plain member — collaborative access to workflows/jobs
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000016'); -- petra

update public.workflows set name = 'Renamed by Petra' where id = test_ctx('wf_workflow_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can rename a project workflow',
    (select name from public.workflows where id = test_ctx('wf_workflow_id')::uuid) = 'Renamed by Petra'
  );
end $$;

update public.render_jobs set status = 'cancelled' where id = test_ctx('wf_job_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can cancel a render job',
    (select status from public.render_jobs where id = test_ctx('wf_job_id')::uuid) = 'cancelled'
  );

  begin
    delete from public.render_jobs where id = test_ctx('wf_job_id')::uuid;
    perform test_assert('render_jobs cannot be deleted by anyone (no delete grant, preserves history)', false);
  exception when insufficient_privilege then
    perform test_assert('render_jobs cannot be deleted by anyone (no delete grant, preserves history)', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000014'); -- noah, not in workflow-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its workflows',
    (select count(*) from public.workflows where id = test_ctx('wf_workflow_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its render jobs',
    (select count(*) from public.render_jobs where id = test_ctx('wf_job_id')::uuid) = 0
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- anon has no access
-- ============================================================

do $$
begin
  begin
    set role anon;
    perform count(*) from public.workflow_templates;
    reset role;
    perform test_assert('anon has no SELECT privilege on workflow_templates', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on workflow_templates', true);
  end;
end $$;

reset role;
