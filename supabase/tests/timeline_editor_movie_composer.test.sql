-- Timeline Editor & Movie Composer (Module 11) assertions. Uses the
-- shared harness from harness.sql. Independent fixtures from other test
-- files (different user ids) since all test files run against the same
-- database in one run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000023', 'wren@example.com', '{"full_name":"Wren"}'),
  ('00000000-0000-0000-0000-000000000024', 'xavi@example.com', '{"full_name":"Xavi"}'),
  ('00000000-0000-0000-0000-000000000025', 'yumi@example.com', '{"full_name":"Yumi"}');

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000023'); -- wren, owner

insert into test_context (key, value)
select 'tec_org_id', (public.create_organization('Composer Co', 'composer-co')).id::text;

select public.add_organization_member(test_ctx('tec_org_id')::uuid, '00000000-0000-0000-0000-000000000024', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('tec_org_id')::uuid, 'Heist Movie')
  returning id
)
insert into test_context (key, value)
select 'tec_project_id', id::text from inserted;

with inserted as (
  insert into public.scenes (project_id, title, scene_order)
  values (test_ctx('tec_project_id')::uuid, 'The Break-In', 1)
  returning id
)
insert into test_context (key, value)
select 'tec_scene_id', id::text from inserted;

with inserted as (
  insert into public.shots (scene_id, shot_order, description)
  values (test_ctx('tec_scene_id')::uuid, 1, 'Nadia approaches the vault door.')
  returning id
)
insert into test_context (key, value)
select 'tec_shot_id', id::text from inserted;

with inserted as (
  insert into public.shots (scene_id, shot_order, description)
  values (test_ctx('tec_scene_id')::uuid, 2, 'The vault door swings open.')
  returning id
)
insert into test_context (key, value)
select 'tec_shot_two_id', id::text from inserted;

-- a real workflow + render job in this project, so source_render_job_id
-- has something legitimate to point at.
with inserted as (
  insert into public.workflows (project_id, name, graph)
  values (
    test_ctx('tec_project_id')::uuid,
    'Test render',
    '{"nodes":[{"id":"a","type":"input","config":{}},{"id":"b","type":"output","config":{}}],"edges":[]}'::jsonb
  )
  returning id
)
insert into test_context (key, value)
select 'tec_workflow_id', id::text from inserted;

with inserted as (
  insert into public.render_jobs (project_id, workflow_id)
  values (test_ctx('tec_project_id')::uuid, test_ctx('tec_workflow_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'tec_render_job_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('tec_project_id')::uuid, 'Rough Cut')
  returning id
)
insert into test_context (key, value)
select 'tec_timeline_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a movie timeline',
    exists (select 1 from public.movie_timelines where id = test_ctx('tec_timeline_id')::uuid)
  );

  perform test_assert(
    'creating a timeline writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'movie_timelines' and target_id = test_ctx('tec_timeline_id') and action = 'movie_timelines.insert'
        and org_id = test_ctx('tec_org_id')::uuid
    )
  );
end $$;

with inserted as (
  insert into public.timeline_clips (timeline_id, shot_id, clip_order, source_render_job_id)
  values (test_ctx('tec_timeline_id')::uuid, test_ctx('tec_shot_id')::uuid, 1, test_ctx('tec_render_job_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'tec_clip_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can add a clip; project_id is derived from the timeline, not client-supplied',
    (select project_id from public.timeline_clips where id = test_ctx('tec_clip_id')::uuid) = test_ctx('tec_project_id')::uuid
  );

  perform test_assert(
    'a clip can reference a render job as its source asset',
    (select source_render_job_id from public.timeline_clips where id = test_ctx('tec_clip_id')::uuid) = test_ctx('tec_render_job_id')::uuid
  );

  perform test_assert(
    'adding a clip writes an audit_logs row scoped to the right org (derived project_id branch)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'timeline_clips' and target_id = test_ctx('tec_clip_id') and action = 'timeline_clips.insert'
        and org_id = test_ctx('tec_org_id')::uuid
    )
  );

  begin
    insert into public.timeline_clips (timeline_id, shot_id, clip_order, trim_start_seconds, trim_end_seconds)
    values (test_ctx('tec_timeline_id')::uuid, test_ctx('tec_shot_two_id')::uuid, 2, 5, 2);
    perform test_assert('a clip''s trim_end_seconds must be after trim_start_seconds', false);
  exception when others then
    perform test_assert('a clip''s trim_end_seconds must be after trim_start_seconds', true);
  end;
end $$;

-- a clip cannot reference a shot from a different project
with other_project as (
  insert into public.projects (org_id, name)
  values (test_ctx('tec_org_id')::uuid, 'Other Project')
  returning id
)
insert into test_context (key, value)
select 'tec_other_project_id', id::text from other_project;

with inserted as (
  insert into public.scenes (project_id, title)
  values (test_ctx('tec_other_project_id')::uuid, 'Other Scene')
  returning id
)
insert into test_context (key, value)
select 'tec_other_scene_id', id::text from inserted;

with inserted as (
  insert into public.shots (scene_id, description)
  values (test_ctx('tec_other_scene_id')::uuid, 'Outsider shot')
  returning id
)
insert into test_context (key, value)
select 'tec_outsider_shot_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('tec_other_project_id')::uuid, 'Other Timeline')
  returning id
)
insert into test_context (key, value)
select 'tec_other_timeline_id', id::text from inserted;

with inserted as (
  insert into public.workflows (project_id, name, graph)
  values (
    test_ctx('tec_other_project_id')::uuid,
    'Other render',
    '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb
  )
  returning id
)
insert into test_context (key, value)
select 'tec_other_workflow_id', id::text from inserted;

with inserted as (
  insert into public.render_jobs (project_id, workflow_id)
  values (test_ctx('tec_other_project_id')::uuid, test_ctx('tec_other_workflow_id')::uuid)
  returning id
)
insert into test_context (key, value)
select 'tec_other_render_job_id', id::text from inserted;

do $$
begin
  begin
    insert into public.timeline_clips (timeline_id, shot_id, clip_order)
    values (test_ctx('tec_timeline_id')::uuid, test_ctx('tec_outsider_shot_id')::uuid, 3);
    perform test_assert('a clip cannot reference a shot from a different project', false);
  exception when others then
    perform test_assert('a clip cannot reference a shot from a different project', true);
  end;

  begin
    insert into public.timeline_clips (timeline_id, shot_id, clip_order, source_render_job_id)
    values (test_ctx('tec_timeline_id')::uuid, test_ctx('tec_shot_two_id')::uuid, 2, test_ctx('tec_other_render_job_id')::uuid);
    perform test_assert('a clip''s source_render_job_id must belong to the same project', false);
  exception when others then
    perform test_assert('a clip''s source_render_job_id must belong to the same project', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- xavi, plain member — collaborative access to timelines/clips
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000024'); -- xavi

update public.movie_timelines set name = 'Renamed by Xavi' where id = test_ctx('tec_timeline_id')::uuid;
update public.timeline_clips set clip_order = 5 where id = test_ctx('tec_clip_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can rename a timeline',
    (select name from public.movie_timelines where id = test_ctx('tec_timeline_id')::uuid) = 'Renamed by Xavi'
  );

  perform test_assert(
    'a plain member (not the creator) can reorder a clip',
    (select clip_order from public.timeline_clips where id = test_ctx('tec_clip_id')::uuid) = 5
  );
end $$;

delete from public.timeline_clips where id = test_ctx('tec_clip_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member can remove a clip — unlike render_jobs, timeline_clips is fully deletable',
    not exists (select 1 from public.timeline_clips where id = test_ctx('tec_clip_id')::uuid)
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000025'); -- yumi, not in composer-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its movie timelines',
    (select count(*) from public.movie_timelines where id = test_ctx('tec_timeline_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its timeline clips',
    (select count(*) from public.timeline_clips where timeline_id = test_ctx('tec_timeline_id')::uuid) = 0
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
    perform count(*) from public.movie_timelines;
    reset role;
    perform test_assert('anon has no SELECT privilege on movie_timelines', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on movie_timelines', true);
  end;
end $$;

reset role;
