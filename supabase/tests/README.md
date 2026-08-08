# Database tests

These tests run against a real PostgreSQL instance and actually exercise
RLS, not just eyeball the SQL. They're deliberately separate from
`supabase/migrations/` and must never be applied to a real Supabase
project: `local_auth_stub.sql` fakes the `auth` schema (`auth.users`,
`auth.uid()`, `auth.role()`) and the `anon`/`authenticated`/`service_role`
roles that Supabase's platform normally provides for free, so migrations
that reference `auth.*` can be applied and tested on a plain Postgres —
locally, or in CI via a `postgres:` service container.

## Running locally

```bash
./supabase/tests/run_tests.sh
```

Requires a reachable Postgres superuser connection (defaults to
`postgresql://postgres:postgres@localhost:5432`, override with
`DATABASE_URL`). Creates and drops a throwaway `xdrama_test` database each
run.

## What's covered

`rls.test.sql` — one assertion per behavior, printed as `ok`/`not ok`
(TAP-lite, no extension required). The script exits non-zero if any
assertion fails, so it's CI-safe. Covers: profile self-service, org
creation atomicity, cross-org isolation (a member of org A cannot see org
B), role-gated updates (member cannot update org, admin can), the
last-owner-removal guard, and audit-log visibility being restricted to
owner/admin.
