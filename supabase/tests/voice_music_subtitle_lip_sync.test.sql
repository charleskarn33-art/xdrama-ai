-- Voice, Music, Subtitle Studios + Lip Sync (Module 12) assertions. Uses
-- the shared harness from harness.sql. Independent fixtures from other
-- test files (different user ids) since all test files run against the
-- same database in one run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000026', 'zara@example.com', '{"full_name":"Zara"}'),
  ('00000000-0000-0000-0000-000000000027', 'axel@example.com', '{"full_name":"Axel"}'),
  ('00000000-0000-0000-0000-000000000028', 'bree@example.com', '{"full_name":"Bree"}');

do $$
begin
  perform test_assert(
    'the seed migration added character_voice_line (voice) and scene_music (audio)',
    (
      select array_agg(task_type order by task_type) from public.routing_rules
      where task_type in ('character_voice_line', 'scene_music')
    ) = array['character_voice_line', 'scene_music']
  );

  perform test_assert(
    'the seed migration added lip_sync, lip_sync category',
    exists (select 1 from public.routing_rules where task_type = 'lip_sync' and category = 'lip_sync')
  );

  perform test_assert(
    'select_model_for_task works against character_voice_line (all-null: nothing installed)',
    (select (public.select_model_for_task('character_voice_line')).id is null)
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000026'); -- zara, owner

insert into test_context (key, value)
select 'vms_org_id', (public.create_organization('Audio Co', 'audio-co')).id::text;

select public.add_organization_member(test_ctx('vms_org_id')::uuid, '00000000-0000-0000-0000-000000000027', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('vms_org_id')::uuid, 'Heist Movie')
  returning id
)
insert into test_context (key, value)
select 'vms_project_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name)
  values (test_ctx('vms_project_id')::uuid, 'Nadia')
  returning id
)
insert into test_context (key, value)
select 'vms_character_id', id::text from inserted;

with inserted as (
  insert into public.scenes (project_id, title)
  values (test_ctx('vms_project_id')::uuid, 'The Break-In')
  returning id
)
insert into test_context (key, value)
select 'vms_scene_id', id::text from inserted;

with inserted as (
  insert into public.shots (scene_id, description)
  values (test_ctx('vms_scene_id')::uuid, 'Nadia approaches the vault door.')
  returning id
)
insert into test_context (key, value)
select 'vms_shot_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('vms_project_id')::uuid, 'Rough Cut')
  returning id
)
insert into test_context (key, value)
select 'vms_timeline_id', id::text from inserted;

with inserted as (
  insert into public.voice_lines (project_id, character_id, shot_id, line_order, text)
  values (test_ctx('vms_project_id')::uuid, test_ctx('vms_character_id')::uuid, test_ctx('vms_shot_id')::uuid, 1, 'The door''s locked. Give me a second.')
  returning id
)
insert into test_context (key, value)
select 'vms_voice_line_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a voice line linked to a character and a shot',
    exists (select 1 from public.voice_lines where id = test_ctx('vms_voice_line_id')::uuid)
  );

  perform test_assert(
    'creating a voice line writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'voice_lines' and target_id = test_ctx('vms_voice_line_id') and action = 'voice_lines.insert'
        and org_id = test_ctx('vms_org_id')::uuid
    )
  );

  begin
    insert into public.voice_lines (project_id, character_id, text)
    values (test_ctx('vms_project_id')::uuid, '00000000-0000-0000-0000-000000000099', 'Bogus character');
    perform test_assert('a voice line cannot link to a character_id that does not exist', false);
  exception when others then
    perform test_assert('a voice line cannot link to a character_id that does not exist', true);
  end;
end $$;

with inserted as (
  insert into public.music_tracks (project_id, scene_id, name, description)
  values (test_ctx('vms_project_id')::uuid, test_ctx('vms_scene_id')::uuid, 'Vault Tension', 'Low, tense synth drone building slowly.')
  returning id
)
insert into test_context (key, value)
select 'vms_music_track_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a music track linked to a scene',
    exists (select 1 from public.music_tracks where id = test_ctx('vms_music_track_id')::uuid)
  );

  perform test_assert(
    'creating a music track writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'music_tracks' and target_id = test_ctx('vms_music_track_id') and action = 'music_tracks.insert'
        and org_id = test_ctx('vms_org_id')::uuid
    )
  );
end $$;

with inserted as (
  insert into public.subtitles (timeline_id, voice_line_id, start_seconds, end_seconds, text)
  values (test_ctx('vms_timeline_id')::uuid, test_ctx('vms_voice_line_id')::uuid, 1.5, 4.0, 'The door''s locked. Give me a second.')
  returning id
)
insert into test_context (key, value)
select 'vms_subtitle_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can add a subtitle; project_id is derived from the timeline, not client-supplied',
    (select project_id from public.subtitles where id = test_ctx('vms_subtitle_id')::uuid) = test_ctx('vms_project_id')::uuid
  );

  perform test_assert(
    'adding a subtitle writes an audit_logs row scoped to the right org (derived project_id branch)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'subtitles' and target_id = test_ctx('vms_subtitle_id') and action = 'subtitles.insert'
        and org_id = test_ctx('vms_org_id')::uuid
    )
  );

  begin
    insert into public.subtitles (timeline_id, start_seconds, end_seconds, text)
    values (test_ctx('vms_timeline_id')::uuid, 5, 2, 'Backwards');
    perform test_assert('a subtitle''s end_seconds must be after start_seconds', false);
  exception when others then
    perform test_assert('a subtitle''s end_seconds must be after start_seconds', true);
  end;
end $$;

-- workflow linking: voice_line and music_track subject types
with inserted as (
  insert into public.workflows (project_id, name, graph, subject_type, subject_id)
  values (
    test_ctx('vms_project_id')::uuid,
    'Voice: line 1',
    '{"nodes":[{"id":"a","type":"input","config":{}},{"id":"b","type":"model_task","config":{"taskType":"character_voice_line","params":{}}},{"id":"c","type":"output","config":{}}],"edges":[{"id":"e1","source":"a","target":"b"},{"id":"e2","source":"b","target":"c"}]}'::jsonb,
    'voice_line',
    test_ctx('vms_voice_line_id')::uuid
  )
  returning id
)
insert into test_context (key, value)
select 'vms_voice_workflow_id', id::text from inserted;

with inserted as (
  insert into public.workflows (project_id, name, graph, subject_type, subject_id)
  values (
    test_ctx('vms_project_id')::uuid,
    'Music: Vault Tension',
    '{"nodes":[{"id":"a","type":"input","config":{}},{"id":"b","type":"model_task","config":{"taskType":"scene_music","params":{}}},{"id":"c","type":"output","config":{}}],"edges":[{"id":"e1","source":"a","target":"b"},{"id":"e2","source":"b","target":"c"}]}'::jsonb,
    'music_track',
    test_ctx('vms_music_track_id')::uuid
  )
  returning id
)
insert into test_context (key, value)
select 'vms_music_workflow_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a workflow can link to a voice line via subject_type=''voice_line''',
    exists (select 1 from public.workflows where id = test_ctx('vms_voice_workflow_id')::uuid)
  );

  perform test_assert(
    'a workflow can link to a music track via subject_type=''music_track''',
    exists (select 1 from public.workflows where id = test_ctx('vms_music_workflow_id')::uuid)
  );
end $$;

-- cross-project rejection for music_tracks.scene_id and subtitles.voice_line_id
with other_project as (
  insert into public.projects (org_id, name)
  values (test_ctx('vms_org_id')::uuid, 'Other Project')
  returning id
)
insert into test_context (key, value)
select 'vms_other_project_id', id::text from other_project;

with inserted as (
  insert into public.scenes (project_id, title)
  values (test_ctx('vms_other_project_id')::uuid, 'Other Scene')
  returning id
)
insert into test_context (key, value)
select 'vms_other_scene_id', id::text from inserted;

with inserted as (
  insert into public.movie_timelines (project_id, name)
  values (test_ctx('vms_other_project_id')::uuid, 'Other Timeline')
  returning id
)
insert into test_context (key, value)
select 'vms_other_timeline_id', id::text from inserted;

do $$
begin
  begin
    insert into public.music_tracks (project_id, scene_id, name)
    values (test_ctx('vms_project_id')::uuid, test_ctx('vms_other_scene_id')::uuid, 'Cross-project');
    perform test_assert('a music track cannot link to a scene from a different project', false);
  exception when others then
    perform test_assert('a music track cannot link to a scene from a different project', true);
  end;

  begin
    insert into public.subtitles (timeline_id, voice_line_id, start_seconds, end_seconds, text)
    values (test_ctx('vms_other_timeline_id')::uuid, test_ctx('vms_voice_line_id')::uuid, 0, 1, 'Cross-project');
    perform test_assert('a subtitle''s voice_line_id must belong to the same project as its timeline', false);
  exception when others then
    perform test_assert('a subtitle''s voice_line_id must belong to the same project as its timeline', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- axel, plain member — collaborative access
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000027'); -- axel

update public.voice_lines set text = 'Edited by Axel' where id = test_ctx('vms_voice_line_id')::uuid;
update public.music_tracks set name = 'Renamed by Axel' where id = test_ctx('vms_music_track_id')::uuid;
update public.subtitles set text = 'Edited by Axel' where id = test_ctx('vms_subtitle_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can edit a voice line',
    (select text from public.voice_lines where id = test_ctx('vms_voice_line_id')::uuid) = 'Edited by Axel'
  );

  perform test_assert(
    'a plain member (not the creator) can rename a music track',
    (select name from public.music_tracks where id = test_ctx('vms_music_track_id')::uuid) = 'Renamed by Axel'
  );

  perform test_assert(
    'a plain member (not the creator) can edit a subtitle',
    (select text from public.subtitles where id = test_ctx('vms_subtitle_id')::uuid) = 'Edited by Axel'
  );
end $$;

delete from public.subtitles where id = test_ctx('vms_subtitle_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member can delete a subtitle',
    not exists (select 1 from public.subtitles where id = test_ctx('vms_subtitle_id')::uuid)
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000028'); -- bree, not in audio-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its voice lines',
    (select count(*) from public.voice_lines where id = test_ctx('vms_voice_line_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its music tracks',
    (select count(*) from public.music_tracks where id = test_ctx('vms_music_track_id')::uuid) = 0
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
    perform count(*) from public.voice_lines;
    reset role;
    perform test_assert('anon has no SELECT privilege on voice_lines', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on voice_lines', true);
  end;
end $$;

reset role;
