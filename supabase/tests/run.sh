#!/usr/bin/env bash
# Runs the migration and RLS tests against a throwaway local Postgres (needs postgresql server binaries).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
D=$(mktemp -d); chown postgres "$D"
su postgres -c "$PGBIN/initdb -D $D/data -A trust >/dev/null && $PGBIN/pg_ctl -D $D/data -o '-p 54399 -k $D' -w start >/dev/null"
trap 'su postgres -c "$PGBIN/pg_ctl -D $D/data -m immediate stop >/dev/null" || true; rm -rf $D' EXIT
P="psql -h $D -p 54399 -U postgres -v ON_ERROR_STOP=1 -q postgres"
chmod -R a+rX tests migrations
su postgres -c "$P -f tests/stub_auth.sql"
for f in migrations/*.sql; do su postgres -c "$P -f $f"; done
su postgres -c "$P -c 'grant all on all tables in schema public to service_role; grant select,insert,update,delete on all tables in schema public to authenticated; grant execute on all functions in schema public to anon, authenticated, service_role;'"
# keep the explicit revokes from the migration meaningful: re-apply them after the blanket grant
su postgres -c "$P -c 'revoke execute on function refresh_premium(uuid), product_json(products) from public, anon, authenticated; revoke execute on function product_by_barcode(text), product_alternatives(uuid), product_json_by_ids(uuid[]), search_products(text), delete_my_account() from anon; grant execute on function refresh_premium(uuid) to service_role;'"
su postgres -c "$P -f tests/rls.sql"
su postgres -c "$P -f seed.sql"
su postgres -c "$P -t -c \"select 'seed products: ' || count(*) from products where source='manual'\""
