-- Module 17: Modal GPU Compute Provider. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids), since all test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000040', 'ursa@example.com', '{"full_name":"Ursa"}'),
  ('00000000-0000-0000-0000-000000000041', 'vito@example.com', '{"full_name":"Vito"}');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000041';

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000040'); -- ursa

insert into test_context (key, value)
select 'mgc_org_id', (public.create_organization('Modal Compute Co', 'modal-compute-co')).id::text;

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('mgc_org_id')::uuid, 'Compute Test Project')
  returning id
)
insert into test_context (key, value)
select 'mgc_project_id', id::text from inserted;

with inserted as (
  insert into public.workflows (project_id, name, graph)
  values (
    test_ctx('mgc_project_id')::uuid,
    'Compute Test Workflow',
    '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb
  )
  returning id
)
insert into test_context (key, value)
select 'mgc_workflow_id', id::text from inserted;

with inserted as (
  insert into public.render_jobs (project_id, workflow_id)
  values (test_ctx('mgc_project_id')::uuid, test_ctx('mgc_workflow_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'mgc_job_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a new render job defaults to the modal compute provider',
    (select compute_provider from public.render_jobs where id = test_ctx('mgc_job_id')::uuid) = 'modal'
  );

  perform test_assert(
    'a new render job has no stage until dispatch sets one',
    (select stage from public.render_jobs where id = test_ctx('mgc_job_id')::uuid) is null
  );
end $$;

update public.render_jobs
set status = 'running', stage = 'starting', provider_job_id = 'fc-test-123'
where id = test_ctx('mgc_job_id')::uuid;

do $$
begin
  perform test_assert(
    'a project member can set the render job''s stage and provider_job_id on dispatch',
    (
      select (stage, provider_job_id) = ('starting', 'fc-test-123')
      from public.render_jobs where id = test_ctx('mgc_job_id')::uuid
    )
  );
end $$;

update public.render_jobs set stage = 'downloading_models' where id = test_ctx('mgc_job_id')::uuid;

do $$
begin
  perform test_assert(
    'the render job stage advances through the pipeline (downloading_models)',
    (select stage from public.render_jobs where id = test_ctx('mgc_job_id')::uuid) = 'downloading_models'
  );
end $$;

update public.render_jobs set stage = 'generating' where id = test_ctx('mgc_job_id')::uuid;
update public.render_jobs set stage = 'post_processing' where id = test_ctx('mgc_job_id')::uuid;
update public.render_jobs set stage = 'uploading' where id = test_ctx('mgc_job_id')::uuid;

do $$
begin
  perform test_assert(
    'the render job stage reaches uploading, the last pre-completion stage',
    (select stage from public.render_jobs where id = test_ctx('mgc_job_id')::uuid) = 'uploading'
  );
end $$;

do $$
begin
  begin
    update public.render_jobs set stage = 'sleeping' where id = test_ctx('mgc_job_id')::uuid;
    perform test_assert('an unknown render job stage is rejected', false);
  exception when invalid_text_representation then
    perform test_assert('an unknown render job stage is rejected', true);
  end;
end $$;

do $$
begin
  perform test_assert(
    'a seeded ai_model has no compute_function_name until an operator wires one up',
    (select compute_function_name from public.ai_models where slug = 'wan-2-2') is null
  );
end $$;

update public.ai_models set compute_function_name = 'generate-wan-2-2' where slug = 'wan-2-2';

do $$
begin
  perform test_assert(
    'a non-admin cannot set an ai_model''s compute_function_name',
    (select compute_function_name from public.ai_models where slug = 'wan-2-2') is null
  );
end $$;

reset role;
select public.clear_local_actor();
set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000041'); -- vito, platform admin

update public.ai_models set compute_function_name = 'generate-wan-2-2' where slug = 'wan-2-2';

do $$
begin
  perform test_assert(
    'a platform admin can wire an ai_model to a Modal function name',
    (select compute_function_name from public.ai_models where slug = 'wan-2-2') = 'generate-wan-2-2'
  );
end $$;

reset role;
select public.clear_local_actor();
