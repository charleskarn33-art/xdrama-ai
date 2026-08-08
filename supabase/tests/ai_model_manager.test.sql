-- AI Model Manager (Module 6) assertions. Uses the shared harness from
-- harness.sql. Independent fixtures from other test files (different
-- user ids) since all test files run against the same database in one
-- run_tests.sh invocation.

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000010', 'judy@example.com', '{"full_name":"Judy"}'),
  ('00000000-0000-0000-0000-000000000011', 'ken@example.com', '{"full_name":"Ken"}');

-- Promote judy to platform admin. There's no self-service way to do this
-- (correctly — see ai_models_insert/update/delete policies), it's a
-- manual/ops action, simulated here the way a real operator would do it:
-- direct row update as a superuser, bypassing RLS.
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-000000000010';

do $$
begin
  perform test_assert(
    'the seed migration populated the model catalog',
    (select count(*) from public.ai_models) >= 20
  );
end $$;

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000011'); -- ken, not a platform admin

do $$
begin
  perform test_assert(
    'any authenticated user can read the model catalog',
    (select count(*) from public.ai_models) >= 20
  );

  perform test_assert(
    'is_platform_admin() is false for a regular user',
    public.is_platform_admin() = false
  );
end $$;

update public.ai_models set is_enabled = true where slug = 'flux';

do $$
begin
  perform test_assert(
    'a non-admin cannot enable a model (RLS silently affects 0 rows)',
    (select is_enabled from public.ai_models where slug = 'flux') = false
  );

  begin
    insert into public.ai_models (slug, name, category)
    values ('rogue-model', 'Rogue Model', 'llm');
    perform test_assert('a non-admin cannot insert a new model', false);
  exception when others then
    perform test_assert('a non-admin cannot insert a new model', true);
  end;
end $$;

reset role;
select public.clear_local_actor();

-- ============================================================
-- judy, platform admin
-- ============================================================

set role authenticated;
select public.set_local_actor('00000000-0000-0000-0000-000000000010'); -- judy

do $$
begin
  perform test_assert(
    'is_platform_admin() is true for a promoted user',
    public.is_platform_admin() = true
  );
end $$;

update public.ai_models set is_enabled = true, install_status = 'installed' where slug = 'flux';

do $$
begin
  perform test_assert(
    'a platform admin can enable and mark a model installed',
    (
      select is_enabled and install_status = 'installed'
      from public.ai_models where slug = 'flux'
    )
  );

  perform test_assert(
    'updating a model writes a platform-level audit_logs row (org_id is null)',
    exists (
      select 1 from public.audit_logs
      where target_type = 'ai_models'
        and action = 'ai_models.update'
        and org_id is null
        and metadata -> 'new' ->> 'install_status' = 'installed'
    )
  );
end $$;

insert into public.ai_models (slug, name, category, description)
values ('custom-internal-model', 'Custom Internal Model', 'llm', 'An internally fine-tuned model.');

do $$
begin
  perform test_assert(
    'a platform admin can add a new model to the registry',
    exists (select 1 from public.ai_models where slug = 'custom-internal-model')
  );

  perform test_assert(
    'a platform admin can see platform-level audit logs (org_id is null)',
    (select count(*) from public.audit_logs where org_id is null) > 0
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
    perform count(*) from public.ai_models;
    reset role;
    perform test_assert('anon has no SELECT privilege on ai_models', false);
  exception when insufficient_privilege then
    reset role;
    perform test_assert('anon has no SELECT privilege on ai_models', true);
  end;
end $$;

reset role;
