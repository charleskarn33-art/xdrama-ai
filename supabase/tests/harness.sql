-- Shared TAP-lite test harness, applied once before any *.test.sql file.
-- Each test file records assertions here rather than defining its own
-- copy, so multiple test files can run against the same database.
--
-- Note: psql's `:'var'` substitution does not reach inside `do $$ ... $$`
-- bodies, so cross-statement values (like a generated id) are threaded
-- through test_context (a real table) instead of psql variables.

create table test_results (description text, passed boolean);
create table test_context (key text primary key, value text);

-- Test-harness tables only: grant broadly so assertions running as
-- authenticated/anon can read/write them regardless of the RLS/RBAC
-- being exercised on the real application tables.
grant all on test_results, test_context to anon, authenticated, service_role;

create or replace function test_assert(p_description text, p_passed boolean)
returns void
language plpgsql
as $$
begin
  insert into test_results (description, passed) values (p_description, p_passed);
  if p_passed then
    raise notice 'ok - %', p_description;
  else
    raise warning 'not ok - %', p_description;
  end if;
end;
$$;

create or replace function test_ctx(p_key text)
returns text
language sql
stable
as $$
  select value from test_context where key = p_key;
$$;
