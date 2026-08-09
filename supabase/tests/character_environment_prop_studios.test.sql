-- Character / Environment / Prop Studios (Module 9) assertions. Uses the
-- shared harness from harness.sql. Independent fixtures from other test
-- files (different user ids) since all test files run against the same
-- database in one run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000017', 'quinn@example.com', '{"full_name":"Quinn"}'),
  ('00000000-0000-0000-0000-000000000018', 'ravi@example.com', '{"full_name":"Ravi"}'),
  ('00000000-0000-0000-0000-000000000019', 'sana@example.com', '{"full_name":"Sana"}');

-- ai_model_manager.test.sql (runs earlier, alphabetically) installs and
-- enables flux as part of its own fixtures. Reset it explicitly rather
-- than assume any model's state — see supabase/tests/README.md.
update public.ai_models set is_enabled = false, install_status = 'not_installed' where slug in ('flux', 'sdxl');

do $$
begin
  perform test_assert(
    'the seed migration added the three reference-art task types, image category',
    (
      select array_agg(task_type order by task_type) from public.routing_rules
      where task_type in ('character_reference_image', 'environment_concept_art', 'prop_render')
        and category = 'image'
    ) = array['character_reference_image', 'environment_concept_art', 'prop_render']
  );

  perform test_assert(
    'select_model_for_task works against the new task types (all-null: nothing installed)',
    (select (public.select_model_for_task('character_reference_image')).id is null)
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000017'); -- quinn, owner

insert into test_context (key, value)
select 'cep_org_id', (public.create_organization('Prop Co', 'prop-co')).id::text;

select public.add_organization_member(test_ctx('cep_org_id')::uuid, '00000000-0000-0000-0000-000000000018', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('cep_org_id')::uuid, 'Short Film')
  returning id
)
insert into test_context (key, value)
select 'cep_project_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name, appearance)
  values (test_ctx('cep_project_id')::uuid, 'Aria', 'Tall, silver hair, worn leather jacket')
  returning id
)
insert into test_context (key, value)
select 'cep_character_id', id::text from inserted;

with inserted as (
  insert into public.locations (project_id, name, description)
  values (test_ctx('cep_project_id')::uuid, 'The Old Pier', 'A fog-covered wooden pier at dawn')
  returning id
)
insert into test_context (key, value)
select 'cep_location_id', id::text from inserted;

with inserted as (
  insert into public.props (project_id, name, appearance)
  values (test_ctx('cep_project_id')::uuid, 'Rusted Lantern', 'A dented brass lantern with a cracked lens')
  returning id
)
insert into test_context (key, value)
select 'cep_prop_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a prop',
    exists (select 1 from public.props where id = test_ctx('cep_prop_id')::uuid)
  );

  perform test_assert(
    'creating a prop writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'props' and target_id = test_ctx('cep_prop_id') and action = 'props.insert'
        and org_id = test_ctx('cep_org_id')::uuid
    )
  );
end $$;

-- ============================================================
-- Linking a workflow to a Story Bible subject
-- ============================================================

with inserted as (
  insert into public.workflows (project_id, name, graph, subject_type, subject_id)
  values (
    test_ctx('cep_project_id')::uuid,
    'Reference art: Aria',
    '{
      "nodes": [
        {"id": "description", "type": "input", "config": {"key": "description"}},
        {"id": "generate", "type": "model_task", "config": {"taskType": "character_reference_image", "params": {}}},
        {"id": "image", "type": "output", "config": {"key": "image"}}
      ],
      "edges": [
        {"id": "e1", "source": "description", "target": "generate"},
        {"id": "e2", "source": "generate", "target": "image"}
      ]
    }'::jsonb,
    'character',
    test_ctx('cep_character_id')::uuid
  )
  returning id
)
insert into test_context (key, value)
select 'cep_char_workflow_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a workflow can link to a character in the same project via subject_type/subject_id',
    exists (select 1 from public.workflows where id = test_ctx('cep_char_workflow_id')::uuid)
  );

  begin
    insert into public.workflows (project_id, name, graph, subject_type, subject_id)
    values (
      test_ctx('cep_project_id')::uuid,
      'Second reference art: Aria',
      '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb,
      'character',
      test_ctx('cep_character_id')::uuid
    );
    perform test_assert('a subject can only have one linked reference-art workflow (partial unique index)', false);
  exception when unique_violation then
    perform test_assert('a subject can only have one linked reference-art workflow (partial unique index)', true);
  end;

  begin
    insert into public.workflows (project_id, name, graph, subject_type, subject_id)
    values (
      test_ctx('cep_project_id')::uuid,
      'Bogus subject',
      '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb,
      'location',
      test_ctx('cep_character_id')::uuid -- a character id, not a location id
    );
    perform test_assert('a workflow cannot link to a subject_id that does not exist in the matching table', false);
  exception when others then
    perform test_assert('a workflow cannot link to a subject_id that does not exist in the matching table', true);
  end;

  begin
    insert into public.workflows (project_id, name, graph, subject_type)
    values (
      test_ctx('cep_project_id')::uuid,
      'Half-set subject',
      '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb,
      'prop'
    );
    perform test_assert('subject_type and subject_id must both be null or both be set', false);
  exception when others then
    perform test_assert('subject_type and subject_id must both be null or both be set', true);
  end;
end $$;

-- a workflow linked to a location in a *different* project must be rejected
with other_project as (
  insert into public.projects (org_id, name)
  values (test_ctx('cep_org_id')::uuid, 'Other Project')
  returning id
)
insert into test_context (key, value)
select 'cep_other_project_id', id::text from other_project;

do $$
begin
  begin
    insert into public.workflows (project_id, name, graph, subject_type, subject_id)
    values (
      test_ctx('cep_other_project_id')::uuid,
      'Cross-project subject',
      '{"nodes":[{"id":"a","type":"input","config":{}}],"edges":[]}'::jsonb,
      'location',
      test_ctx('cep_location_id')::uuid -- belongs to cep_project_id, not cep_other_project_id
    );
    perform test_assert('a workflow cannot link to a subject belonging to a different project', false);
  exception when others then
    perform test_assert('a workflow cannot link to a subject belonging to a different project', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- ravi, plain member — collaborative access to props
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000018'); -- ravi

update public.props set description = 'Edited by Ravi' where id = test_ctx('cep_prop_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can update a prop',
    (select description from public.props where id = test_ctx('cep_prop_id')::uuid) = 'Edited by Ravi'
  );
end $$;

delete from public.props where id = test_ctx('cep_prop_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can delete a prop — story bible entries are collaborative',
    not exists (select 1 from public.props where id = test_ctx('cep_prop_id')::uuid)
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000019'); -- sana, not in prop-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its props',
    (select count(*) from public.props where project_id = test_ctx('cep_project_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its subject-linked workflows',
    (select count(*) from public.workflows where id = test_ctx('cep_char_workflow_id')::uuid) = 0
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
    perform count(*) from public.props;
    reset role;
    perform test_assert('anon has no SELECT privilege on props', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on props', true);
  end;
end $$;

reset role;
