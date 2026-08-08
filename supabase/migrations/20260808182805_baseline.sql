-- Module 1: Foundation baseline.
-- Extensions and helpers shared by every future migration. No application
-- tables here — Module 2 (Auth & Core Schema) owns the first real schema.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Reusable trigger to keep an `updated_at` column current on every UPDATE.
-- Every application table created from Module 2 onward should attach this,
-- e.g.:
--   create trigger set_updated_at before update on public.projects
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: sets updated_at = now() on row update. Attach to every table with an updated_at column.';
