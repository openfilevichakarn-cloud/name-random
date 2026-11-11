#!/usr/bin/env bash
# Apply the migrations to a throw-away database and run the RLS tests.
#
# Needs a reachable PostgreSQL 15+ server and a role that may create databases and roles.
# Connection settings come from the usual libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD).
#
#   npm run test:db
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
db="ngsr_rls_test_$$"
admin_db="${PGDATABASE:-postgres}"

cleanup() {
  psql -X -q -d "$admin_db" -c "drop database if exists $db" >/dev/null 2>&1 || true
  # The API roles are cluster-wide: drop them again unless they existed before this run.
  if [[ "${created_roles:-0}" == 1 ]]; then
    psql -X -q -d "$admin_db" -c "drop role if exists anon; drop role if exists authenticated; drop role if exists service_role;" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if psql -X -At -d "$admin_db" -c "select 1 from pg_roles where rolname = 'authenticated'" | grep -q 1; then
  echo "error: role 'authenticated' already exists on this server; run the tests on a server without Supabase roles." >&2
  exit 1
fi

psql -X -q -d "$admin_db" -c "create database $db"
created_roles=1

run() {
  psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"
}

run -f "$here/supabase_shim.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  run -f "$migration"
done
run -o /dev/null -f "$here/rls.test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
