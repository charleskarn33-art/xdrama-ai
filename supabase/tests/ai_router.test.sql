-- AI Router (Module 7) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids) since all test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000012', 'liam@example.com', '{"full_name":"Liam"}'),
  ('00000000-0000-0000-0000-000000000013', 'mia@example.com', '{"full_name":"Mia"}');

update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000012';

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000013'); -- mia, not an admin

do $$
begin
  perform test_assert(
    'the seed migration populated the six routing rules from the brief',
    (select count(*) from public.routing_rules) = 6
  );

  perform test_assert(
    'any authenticated user can read routing rules',
    exists (select 1 from public.routing_rules where task_type = 'fast_draft')
  );

  perform test_assert(
    'with nothing installed yet, the router returns an all-null row for a known task type',
    ((select public.select_model_for_task('movie')).id is null)
  );

  perform test_assert(
    'the router returns an all-null row for an unknown task type',
    ((select public.select_model_for_task('does-not-exist')).id is null)
  );

  begin
    insert into public.routing_rules (task_type, category, preferred_model_slugs)
    values ('rogue_rule', 'video', array['wan-2-2']);
    perform test_assert('a non-admin cannot insert a routing rule', false);
  exception when others then
    perform test_assert('a non-admin cannot insert a routing rule', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- liam, platform admin: install/enable models and watch routing react
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000012'); -- liam

-- movie's chain is [wan-2-2, open-sora, hunyuan-video]; install the
-- *second* entry first to prove the router actually walks the chain
-- rather than always taking the first slug.
update public.ai_models set is_enabled = true, install_status = 'installed' where slug = 'open-sora';

do $$
begin
  perform test_assert(
    'the router falls through to the next chain entry when the first is not installed',
    (select slug from public.select_model_for_task('movie')) = 'open-sora'
  );
end $$;

update public.ai_models set is_enabled = true, install_status = 'installed' where slug = 'wan-2-2';

do $$
begin
  perform test_assert(
    'the router prefers an earlier chain entry once it becomes available',
    (select slug from public.select_model_for_task('movie')) = 'wan-2-2'
  );

  perform test_assert(
    -- category fallback orders by (created_at, slug); wan-2-2 and
    -- open-sora share created_at (both came from one bulk seed INSERT,
    -- which evaluates now() once for the whole statement), so slug is
    -- the actual tiebreaker: 'open-sora' < 'wan-2-2'.
    'fast_draft (chain: [ltx-video], not installed) falls back to any installed model in its category',
    (select slug from public.select_model_for_task('fast_draft')) = 'open-sora'
  );

  perform test_assert(
    'Advanced Mode override returns the requested model when it is eligible',
    (select slug from public.select_model_for_task('movie', 'open-sora')) = 'open-sora'
  );
end $$;

-- Explicitly reset sdxl's state rather than assuming no other *.test.sql
-- file has touched it — all test files share one database within a
-- run_tests.sh invocation, so "assume model X is untouched" is exactly
-- the kind of cross-file assumption that already broke a test once
-- (see rls.test.sql's profile-count fix).
update public.ai_models set is_enabled = false, install_status = 'not_installed' where slug = 'sdxl';

do $$
begin
  perform test_assert(
    'Advanced Mode override returns an all-null row for a model that is not installed',
    ((select public.select_model_for_task('movie', 'sdxl')).id is null)
  );

  begin
    insert into public.routing_rules (task_type, category, preferred_model_slugs)
    values ('invalid_rule', 'video', array['not-a-real-model-slug']);
    perform test_assert('a routing rule cannot reference an unknown model slug', false);
  exception when others then
    perform test_assert('a routing rule cannot reference an unknown model slug', true);
  end;

end $$;

insert into public.routing_rules (task_type, category, preferred_model_slugs)
values ('image_conditioning', 'image', array['controlnet']);

do $$
begin
  perform test_assert(
    'a platform admin can add a valid routing rule',
    exists (select 1 from public.routing_rules where task_type = 'image_conditioning')
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
    perform count(*) from public.routing_rules;
    reset role;
    perform test_assert('anon has no SELECT privilege on routing_rules', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on routing_rules', true);
  end;
end $$;

reset role;
