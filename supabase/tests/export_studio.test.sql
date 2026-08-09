-- Export Studio (Module 14) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids) since all test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000032', 'finn@example.com', '{"full_name":"Finn"}'),
  ('00000000-0000-0000-0000-000000000033', 'gwen@example.com', '{"full_name":"Gwen"}'),
  ('00000000-0000-0000-0000-000000000034', 'hugo@example.com', '{"full_name":"Hugo"}');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000032';

do $$
begin
  perform test_assert(
    'the seed migration populated all five export presets named in the brief-adjacent platforms',
    (select array_agg(platform order by platform) from public.export_presets)
      = array['instagram_feed', 'instagram_reels', 'tiktok', 'youtube', 'youtube_shorts']
  );

  perform test_assert(
    'the youtube-landscape preset has real 1920x1080 dimensions',
    (select width = 1920 and height = 1080 from public.export_presets where slug = 'youtube-landscape')
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000033'); -- gwen, not an admin

do $$
begin
  perform test_assert(
    'any authenticated user can read export presets',
    (select count(*) from public.export_presets) = 5
  );

  begin
    insert into public.export_presets (slug, name, platform, width, height, format)
    values ('rogue', 'Rogue', 'rogue', 100, 100, 'mp4');
    perform test_assert('a non-admin cannot insert an export preset', false);
  exception when others then
    perform test_assert('a non-admin cannot insert an export preset', true);
  end;
end $$;

insert into test_context (key, value)
select 'exp_org_id', (public.create_organization('Export Co', 'export-co')).id::text;

select public.add_organization_member(test_ctx('exp_org_id')::uuid, '00000000-0000-0000-0000-000000000034', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('exp_org_id')::uuid, 'Heist Movie')
  returning id
)
insert into test_context (key, value)
select 'exp_project_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('exp_project_id')::uuid, 'Final Cut')
  returning id
)
insert into test_context (key, value)
select 'exp_timeline_id', id::text from inserted;

with inserted as (
  insert into public.export_jobs (timeline_id, preset_id)
  select test_ctx('exp_timeline_id')::uuid, id from public.export_presets where slug = 'youtube-landscape'
  returning id
)
insert into test_context (key, value)
select 'exp_job_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create an export job, defaulting to queued, project_id derived from the timeline',
    (
      select status = 'queued' and project_id = test_ctx('exp_project_id')::uuid
      from public.export_jobs where id = test_ctx('exp_job_id')::uuid
    )
  );

  perform test_assert(
    'creating an export job writes an audit_logs row scoped to the right org (derived project_id branch)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'export_jobs' and target_id = test_ctx('exp_job_id') and action = 'export_jobs.insert'
        and org_id = test_ctx('exp_org_id')::uuid
    )
  );

  begin
    insert into public.export_jobs (timeline_id)
    values ('00000000-0000-0000-0000-000000000099');
    perform test_assert('an export job cannot reference a timeline_id that does not exist', false);
  exception when others then
    perform test_assert('an export job cannot reference a timeline_id that does not exist', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- hugo, plain member — collaborative access (the orchestrator updates
-- status through a user-scoped client, so any project member's update
-- grant must work, not just the requester's)
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000034'); -- hugo

update public.export_jobs
set status = 'failed', error_message = 'No rendered clips available to export yet.'
where id = test_ctx('exp_job_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the requester) can update an export job''s status, e.g. after dispatch',
    (select status from public.export_jobs where id = test_ctx('exp_job_id')::uuid) = 'failed'
  );

  begin
    delete from public.export_jobs where id = test_ctx('exp_job_id')::uuid;
    perform test_assert('export_jobs cannot be deleted by anyone (no delete grant, preserves export history)', false);
  exception when insufficient_privilege then
    perform test_assert('export_jobs cannot be deleted by anyone (no delete grant, preserves export history)', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000032'); -- finn, not in export-co (platform admin, but not an org member)

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its export jobs',
    (select count(*) from public.export_jobs where id = test_ctx('exp_job_id')::uuid) = 0
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
    perform count(*) from public.export_presets;
    reset role;
    perform test_assert('anon has no SELECT privilege on export_presets', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on export_presets', true);
  end;

  begin
    set role anon;
    perform count(*) from public.export_jobs;
    reset role;
    perform test_assert('anon has no SELECT privilege on export_jobs', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on export_jobs', true);
  end;
end $$;

reset role;
