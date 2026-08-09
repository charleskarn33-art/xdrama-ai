-- AI Director / Cinematographer / Producer (Module 13) assertions. Uses
-- the shared harness from harness.sql. Independent fixtures from other
-- test files (different user ids) since all test files run against the
-- same database in one run_tests.sh invocation. Runs first alphabetically
-- (ai_ prefix, before ai_model_manager), so it cannot assume any other
-- test file's state either — same standing rule as always, just from the
-- other direction this time.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000029', 'cyrus@example.com', '{"full_name":"Cyrus"}'),
  ('00000000-0000-0000-0000-000000000030', 'delia@example.com', '{"full_name":"Delia"}'),
  ('00000000-0000-0000-0000-000000000031', 'ezra@example.com', '{"full_name":"Ezra"}');

do $$
begin
  perform test_assert(
    'the seed migration added the three advisor task types, llm category',
    (
      select array_agg(task_type order by task_type) from public.routing_rules
      where task_type in ('director_suggestions', 'cinematographer_suggestions', 'producer_suggestions')
        and category = 'llm'
    ) = array['cinematographer_suggestions', 'director_suggestions', 'producer_suggestions']
  );

  perform test_assert(
    'select_model_for_task works against director_suggestions (all-null: nothing installed)',
    (select (public.select_model_for_task('director_suggestions')).id is null)
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000029'); -- cyrus, owner

insert into test_context (key, value)
select 'adcp_org_id', (public.create_organization('Advisor Co', 'advisor-co')).id::text;

select public.add_organization_member(test_ctx('adcp_org_id')::uuid, '00000000-0000-0000-0000-000000000030', 'member');

with inserted as (
  insert into public.projects (org_id, name)
  values (test_ctx('adcp_org_id')::uuid, 'Heist Movie')
  returning id
)
insert into test_context (key, value)
select 'adcp_project_id', id::text from inserted;

with inserted as (
  insert into public.ai_suggestions (project_id, role, prompt)
  values (test_ctx('adcp_project_id')::uuid, 'director', 'Script: INT. VAULT - NIGHT...')
  returning id
)
insert into test_context (key, value)
select 'adcp_suggestion_id', id::text from inserted;

do $$
begin
  perform test_assert(
    'a project member can request advisor suggestions, defaulting to pending',
    (select status from public.ai_suggestions where id = test_ctx('adcp_suggestion_id')::uuid) = 'pending'
  );

  perform test_assert(
    'creating a suggestion request writes an audit_logs row scoped to the right org',
    exists (
      select 1 from public.audit_logs
      where target_type = 'ai_suggestions' and target_id = test_ctx('adcp_suggestion_id') and action = 'ai_suggestions.insert'
        and org_id = test_ctx('adcp_org_id')::uuid
    )
  );

  begin
    insert into public.ai_suggestions (project_id, role, prompt)
    values (test_ctx('adcp_project_id')::uuid, 'wizard', 'Bogus role');
    perform test_assert('an unknown advisor role is rejected', false);
  exception when others then
    perform test_assert('an unknown advisor role is rejected', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- delia, plain member — collaborative access (the orchestrator updates
-- status/result through a user-scoped client, so any project member's
-- update grant must work, not just the requester's)
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000030'); -- delia

update public.ai_suggestions
set status = 'failed', error_message = 'No eligible LLM model installed.'
where id = test_ctx('adcp_suggestion_id')::uuid;

do $$
begin
  perform test_assert(
    'a plain member (not the requester) can update a suggestion''s status, e.g. after dispatch',
    (select status from public.ai_suggestions where id = test_ctx('adcp_suggestion_id')::uuid) = 'failed'
  );

  begin
    delete from public.ai_suggestions where id = test_ctx('adcp_suggestion_id')::uuid;
    perform test_assert('ai_suggestions cannot be deleted by anyone (no delete grant, preserves advisory history)', false);
  exception when insufficient_privilege then
    perform test_assert('ai_suggestions cannot be deleted by anyone (no delete grant, preserves advisory history)', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- Cross-org isolation
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000031'); -- ezra, not in advisor-co

do $$
begin
  perform test_assert(
    'a user outside the org cannot see its suggestion requests',
    (select count(*) from public.ai_suggestions where id = test_ctx('adcp_suggestion_id')::uuid) = 0
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
    perform count(*) from public.ai_suggestions;
    reset role;
    perform test_assert('anon has no SELECT privilege on ai_suggestions', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on ai_suggestions', true);
  end;
end $$;

reset role;
