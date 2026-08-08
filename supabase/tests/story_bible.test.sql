-- Story Bible (Module 4) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from rls.test.sql (different user
-- ids) since both test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000004', 'dave@example.com', '{"full_name":"Dave"}'),
  ('00000000-0000-0000-0000-000000000005', 'erin@example.com', '{"full_name":"Erin"}'),
  ('00000000-0000-0000-0000-000000000006', 'frank@example.com', '{"full_name":"Frank"}');

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000004'); -- dave

insert into test_context (key, value)
select 'sb_org_id', (public.create_organization('Story Co', 'story-co')).id::text;

select public.add_organization_member(test_ctx('sb_org_id')::uuid, '00000000-0000-0000-0000-000000000005', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('sb_org_id')::uuid, 'Feature Film')
  returning id
)
insert into test_context (key, value)
select 'sb_project_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name, appearance, personality)
  values (test_ctx('sb_project_id')::uuid, 'Hero', 'Tall, scarred', 'Stoic but kind')
  returning id
)
insert into test_context (key, value)
select 'sb_hero_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name)
  values (test_ctx('sb_project_id')::uuid, 'Villain')
  returning id
)
insert into test_context (key, value)
select 'sb_villain_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can create a character',
    (select name from public.characters where id = test_ctx('sb_hero_id')::uuid) = 'Hero'
  );

  perform test_assert(
    'creating a character writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'characters'
        and target_id = test_ctx('sb_hero_id')
        and action = 'characters.insert'
        and org_id = test_ctx('sb_org_id')::uuid
    )
  );
end $$;

-- relationship between two characters in the same project
insert into public.character_relationships (character_id, related_character_id, relationship_type, description)
values (test_ctx('sb_hero_id')::uuid, test_ctx('sb_villain_id')::uuid, 'rival', 'Childhood friends turned enemies');

do $$
begin
  perform test_assert(
    'character_relationships auto-populates project_id from the characters',
    (
      select project_id from public.character_relationships
      where character_id = test_ctx('sb_hero_id')::uuid
    ) = test_ctx('sb_project_id')::uuid
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- erin (plain member) — read/write access, same as dave
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000005'); -- erin

do $$
begin
  perform test_assert(
    'a plain project member can see characters in their project',
    (select count(*) from public.characters where project_id = test_ctx('sb_project_id')::uuid) = 2
  );
end $$;

insert into public.locations (project_id, name, description)
values (test_ctx('sb_project_id')::uuid, 'The Old Mill', 'Where the final confrontation happens');

insert into public.timeline_events (project_id, title, in_story_date, event_order)
values (test_ctx('sb_project_id')::uuid, 'Hero leaves home', 'Day 1', 1);

insert into public.story_bible_notes (project_id, title, content)
values (test_ctx('sb_project_id')::uuid, 'Magic system', 'Magic is fueled by memories, not mana.');

do $$
begin
  perform test_assert(
    'a plain member can create a location',
    (select count(*) from public.locations where project_id = test_ctx('sb_project_id')::uuid) = 1
  );

  perform test_assert(
    'a plain member can create a timeline event',
    (select count(*) from public.timeline_events where project_id = test_ctx('sb_project_id')::uuid) = 1
  );

  perform test_assert(
    'a plain member can create a story bible note',
    (select count(*) from public.story_bible_notes where project_id = test_ctx('sb_project_id')::uuid) = 1
  );
end $$;

update public.characters set personality = 'Reluctant hero, softens over time'
where id = test_ctx('sb_hero_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can update a character',
    (select personality from public.characters where id = test_ctx('sb_hero_id')::uuid)
      = 'Reluctant hero, softens over time'
  );
end $$;

delete from public.characters where id = test_ctx('sb_villain_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the creator) can delete a character — story bible entries are collaborative, unlike projects',
    (select count(*) from public.characters where id = test_ctx('sb_villain_id')::uuid) = 0
  );

  perform test_assert(
    'deleting a character cascades its relationships',
    (select count(*) from public.character_relationships where character_id = test_ctx('sb_hero_id')::uuid) = 0
  );
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-project integrity guard
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000004'); -- dave

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('sb_org_id')::uuid, 'Unrelated Short Film')
  returning id
)
insert into test_context (key, value)
select 'sb_other_project_id', id::text from inserted;

with inserted as (
  insert into public.characters (project_id, name)
  values (test_ctx('sb_other_project_id')::uuid, 'Outsider')
  returning id
)
insert into test_context (key, value)
select 'sb_outsider_id', id::text from inserted;

do $$
begin
  begin
    insert into public.character_relationships (character_id, related_character_id, relationship_type)
    values (test_ctx('sb_hero_id')::uuid, test_ctx('sb_outsider_id')::uuid, 'stranger');
    perform test_assert('cannot relate characters from two different projects', false);
  exception when others then
    perform test_assert('cannot relate characters from two different projects', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000006'); -- frank, not in story-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its characters',
    (select count(*) from public.characters where project_id = test_ctx('sb_project_id')::uuid) = 0
  );

  perform test_assert(
    'a user outside the org cannot see its locations',
    (select count(*) from public.locations where project_id = test_ctx('sb_project_id')::uuid) = 0
  );

  begin
    insert into public.story_bible_notes (project_id, title)
    values (test_ctx('sb_project_id')::uuid, 'Trespass note');
    perform test_assert('a user outside the org cannot create story bible notes for it', false);
  exception when others then
    perform test_assert('a user outside the org cannot create story bible notes for it', true);
  end;
end $$;

reset role;
select public.clear_local_actor();
