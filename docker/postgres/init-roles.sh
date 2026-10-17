#!/bin/sh
# Runs once, on the first start of the Postgres container.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_password="$JT_OWNER_PASSWORD" \
  -v app_password="$JT_APP_PASSWORD" \
  -v auth_password="$JT_AUTH_PASSWORD" \
  -v db_name="${JT_DB_NAME:-jobtracker}" \
  -f /docker-entrypoint-initdb.d/roles.sql.tpl
