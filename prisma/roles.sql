-- Database roles for Job Tracker (A5). Run ONCE as a Postgres superuser on a
-- fresh server, with psql variables:
--   psql -v owner_password=... -v app_password=... -v auth_password=... \
--        -v db_name=jobtracker -f prisma/roles.sql
--
-- jt_owner  owns every table; used only to run migrations.
-- jt_app    the app's everyday role: non-owner, NOBYPASSRLS, every query is
--           filtered by row-level security.
-- jt_auth   login, sign-up and token checks, which happen before a user id is
--           known. Can only touch the auth tables (see rls.sql).

CREATE ROLE jt_owner LOGIN PASSWORD :'owner_password' NOSUPERUSER CREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE jt_app   LOGIN PASSWORD :'app_password'   NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE jt_auth  LOGIN PASSWORD :'auth_password'  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

CREATE DATABASE :"db_name" OWNER jt_owner;

\connect :"db_name"

ALTER SCHEMA public OWNER TO jt_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO jt_app, jt_auth;

-- pg-boss keeps its queue tables in its own schema, owned by the app role.
CREATE SCHEMA pgboss AUTHORIZATION jt_app;
