-- Storyboard & Scene Studio (Module 10) assertions. Uses the shared
-- harness from harness.sql. Independent fixtures from other test files
-- (different user ids) since all test files run against the same
-- database in one run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000020', 'tara@example.com', '{"full_name":"Tara"}'),
  ('00000000-0000-0000-0000-000000000021', 'umar@example.com', '{"full_name":"Umar"}'),
  ('00000000-0000-0000-0000-000000000022', 'vera@example.com', '{"full_name":"Vera"}');

-- ai_model_manager.test.sql installs and enables flux as part of its own
-- fixtures. Reset it explicitly rather than assume any model's state.
update public.ai_models set is_enabled = false, install_status = 'not_installed' where slug in ('flux', 'sdxl');

do $$
begin
  perform test_assert(
    'the seed migration added the storyboard_frame task type, image category',
    exists (select 1 from public.routing_rules where task_type = 'storyboard_frame' and category = 'image')
  );

  perform test_assert(
    'select_model_for_task works against storyboard_frame (all-null: nothing installed)',
    (select (public.select_model_for_task('storyboard_frame')).id is null)
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000020'); -- tara, owner

insert into test_context (key, value)
select 'sss_org_id', (public.create_organization('Storyboard Co', 'storyboard-co')).id::text;

select public.add_organization_member(test_ctx('sss_org_id')::uuid, '00000000-0000-0000-0000-000000000021', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('sss_org_id')::uuid, 'Heist Movie')
  returning id
)
insert into test_context (key, value)
select 'sss_project_id', id::text from inserted;

with inserted as (
  insert into public.scripts (project_id, title, content)
  values (test_ctx('sss_project_id')::uuid, 'Draft One', 'INT. VAULT - NIGHT')
  returning id
)
insert into test_context (key, value)
select 'sss_script_id', id::text from inserted;

with inserted as (
  insert into public.locations (project_id, name)
  values (test_ctx('sss_project_id')::uuid, 'The Vault')
  returning id
)
insert into test_context (key, value)
select 'sss_location_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name)
  values (test_ctx('sss_project_id')::uuid, 'Nadia')
  returning id
)
insert into test_context (key, value)
select 'sss_character_id', id::text from inserted;

with inserted as (
  insert into public.scenes (project_id, script_id, location_id, title, scene_order)
  values (test_ctx('sss_project_id')::uuid, test_ctx('sss_script_id')::uuid, test_ctx('sss_location_id')::uuid, 'The Break-In', 1)
  returning id
)
insert into test_context (key, value)
select 'sss_scene_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a scene linked to a script and a location',
    exists (select 1 from public.scenes where id = test_ctx('sss_scene_id')::uuid)
  );

  perform test_assert(
    'creating a scene writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'scenes' and target_id = test_ctx('sss_scene_id') and action = 'scenes.insert'
        and org_id = test_ctx('sss_org_id')::uuid
    )
  );

  begin
    insert into public.scenes (project_id, title, script_id)
    values (test_ctx('sss_project_id')::uuid, 'Bogus script link', '00000000-0000-0000-0000-000000000099');
    perform test_assert('a scene cannot link to a script_id that does not exist', false);
  exception when others then
    perform test_assert('a scene cannot link to a script_id that does not exist', true);
  end;
end $$;

with inserted as (
  insert into public.shots (scene_id, shot_order, shot_type, description)
  values (test_ctx('sss_scene_id')::uuid, 1, 'wide', 'Nadia approaches the vault door.')
  returning id
)
insert into test_context (key, value)
select 'sss_shot_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a shot; project_id is derived from the scene, not client-supplied',
    (select project_id from public.shots where id = test_ctx('sss_shot_id')::uuid) = test_ctx('sss_project_id')::uuid
  );

  perform test_assert(
    'creating a shot writes an audit_logs row scoped to the right org (derived project_id branch)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'shots' and target_id = test_ctx('sss_shot_id') and action = 'shots.insert'
        and org_id = test_ctx('sss_org_id')::uuid
    )
  );
end $$;

insert into public.shot_characters (shot_id, character_id)
values (test_ctx('sss_shot_id')::uuid, test_ctx('sss_character_id')::uuid);

do $$
begin
  perform test_assert(
    'a character can be tagged in a shot',
    exists (
      select 1 from public.shot_characters
      where shot_id = test_ctx('sss_shot_id')::uuid and character_id = test_ctx('sss_character_id')::uuid
    )
  );

  perform test_assert(
    'tagging a character in a shot derives project_id and matches the shot''s project',
    (select project_id from public.shot_characters where shot_id = test_ctx('sss_shot_id')::uuid) = test_ctx('sss_project_id')::uuid
  );
end $$;

-- a shot cannot be tagged with a character from a different project
with other_project as (
  insert into public.projects (org_id, name)
  values (test_ctx('sss_org_id')::uuid, 'Other Project')
  returning id
)
insert into test_context (key, value)
select 'sss_other_project_id', id::text from other_project;

with inserted as (
  insert into public.characters (project_id, name)
  values (test_ctx('sss_other_project_id')::uuid, 'Outsider')
  returning id
)
insert into test_context (key, value)
select 'sss_outsider_character_id', id::text from inserted;

do $$
begin
  begin
    insert into public.shot_characters (shot_id, character_id)
    values (test_ctx('sss_shot_id')::uuid, test_ctx('sss_outsider_character_id')::uuid);
    perform test_assert('a shot cannot be tagged with a character from a different project', false);
  exception when others then
    perform test_assert('a shot cannot be tagged with a character from a different project', true);
  end;
end $$;

-- a workflow can link to a shot (storyboard frame generation), reusing
-- Module 9's workflow_subject_type/subject_id, now extended with 'shot'.
with inserted as (
  insert into public.workflows (project_id, name, graph, subject_type, subject_id)
  values (
    test_ctx('sss_project_id')::uuid,
    'Storyboard frame: shot 1',
    '{
      "nodes": [
        {"id": "description", "type": "input", "config": {"key": "description"}},
        {"id": "generate", "type": "model_task", "config": {"taskType": "storyboard_frame", "params": {}}},
        {"id": "image", "type": "output", "config": {"key": "image"}}
      ],
      "edges": [
        {"id": "e1", "source": "description", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "image"}
      ]
    }'::jsonb,
    'shot',
    test_ctx('sss_shot_id')::uuid
  )
  returning id
)
insert into test_context (key, value)
select 'sss_shot_workflow_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a workflow can link to a shot via subject_type=''shot''',
    exists (select 1 from public.workflows where id = test_ctx('sss_shot_workflow_id')::uuid)
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- umar, plain member — collaborative access to scenes/shots
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000021'); -- umar

update public.scenes set title = 'Renamed by Umar' where id = test_ctx('sss_scene_id')::uuid;
update public.shots set description = 'Edited by Umar' where id = test_ctx('sss_shot_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can rename a scene',
    (select title from public.scenes where id = test_ctx('sss_scene_id')::uuid) = 'Renamed by Umar'
  );

  perform test_assert(
    'a plain member (not the creator) can edit a shot — story bible entries are collaborative',
    (select description from public.shots where id = test_ctx('sss_shot_id')::uuid) = 'Edited by Umar'
  );
end $$;

delete from public.shot_characters
  where shot_id = test_ctx('sss_shot_id')::uuid and character_id = test_ctx('sss_character_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member can untag a character from a shot',
    not exists (
      select 1 from public.shot_characters
      where shot_id = test_ctx('sss_shot_id')::uuid and character_id = test_ctx('sss_character_id')::uuid
    )
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000022'); -- vera, not in storyboard-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its scenes',
    (select count(*) from public.scenes where id = test_ctx('sss_scene_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its shots',
    (select count(*) from public.shots where id = test_ctx('sss_shot_id')::uuid) = 0
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
    perform count(*) from public.scenes;
    reset role;
    perform test_assert('anon has no SELECT privilege on scenes', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on scenes', true);
  end;
end $$;

reset role;
