#!/usr/bin/env bash
# Applies every migration plus the local auth stub to a throwaway database,
# then runs every *.test.sql file in this directory. Exits non-zero on any
# failed assertion or SQL error, so it's usable from CI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
TEST_DB_NAME="${TEST_DB_NAME:-xdrama_test}"

# Split DATABASE_URL into a connection to the `postgres` maintenance DB so
# we can drop/create the test DB regardless of what DB name was passed in.
ADMIN_URL="$(python3 -c "
import sys
from urllib.parse import urlsplit, urlunsplit
parts = urlsplit(sys.argv[1])
print(urlunsplit((parts.scheme, parts.netloc, '/postgres', '', '')))
" "$DATABASE_URL")"

TEST_URL="$(python3 -c "
import sys
from urllib.parse import urlsplit, urlunsplit
parts = urlsplit(sys.argv[1])
print(urlunsplit((parts.scheme, parts.netloc, '/' + sys.argv[2], '', '')))
" "$DATABASE_URL" "$TEST_DB_NAME")"

echo "==> Recreating $TEST_DB_NAME"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $TEST_DB_NAME;"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "create database $TEST_DB_NAME;"

echo "==> Applying auth stub"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/local_auth_stub.sql"

echo "==> Applying migrations"
for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "    $(basename "$migration")"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$migration"
done

echo "==> Applying test harness"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/harness.sql"

echo "==> Running test suites"
for test_file in "$SCRIPT_DIR"/*.test.sql; do
  echo "    $(basename "$test_file")"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$test_file"
done

echo "==> Summary"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -c "
do \$\$
declare
  v_failed int;
  v_total int;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from test_results;
  raise notice '--- % / % assertions passed ---', v_total - v_failed, v_total;
  if v_failed > 0 then
    raise exception '% assertion(s) failed', v_failed;
  end if;
end \$\$;
"
