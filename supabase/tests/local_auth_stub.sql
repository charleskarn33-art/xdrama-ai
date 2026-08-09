-- Fakes just enough of Supabase's platform-provided `auth` schema and
-- roles to apply and test our migrations on plain PostgreSQL. Never run
-- this against a real Supabase project — it already has the real thing.

-- Roles are cluster-global in Postgres (unlike the database this script
-- runs against, which run_tests.sh drops/recreates every run), so guard
-- creation to keep repeated local runs idempotent.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase's platform bootstrap also provisions this schema for extensions.
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase's platform bootstrap also creates this publication; migrations
-- add tables to it (e.g. Module 8's `alter publication ... add table
-- render_jobs`) to enable Realtime for them.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Real Supabase reads these from the request's verified JWT, set by
-- PostgREST as Postgres session GUCs. We set them directly in tests via
-- set_local_actor() below to simulate "logged in as user X".
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

-- Test-only helper: real Supabase never has this, PostgREST sets the GUCs
-- itself from the verified JWT.
-- is_local = false: persists for the whole session (psql runs each
-- top-level statement as its own implicit transaction under autocommit,
-- so a transaction-local setting would vanish before the next statement).
create or replace function public.set_local_actor(p_user_id uuid, p_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', p_role, false);
end;
$$;

create or replace function public.clear_local_actor()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
end;
$$;
