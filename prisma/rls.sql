-- Row-level security, grants and database functions for Job Tracker (A5).
--
-- Applied as jt_owner after every `prisma migrate deploy` (see
-- prisma/apply-sql.mts). The file is idempotent: it can be re-run safely.
--
-- Rules:
-- * Every user-owned table has RLS enabled, with a policy that only
--   lets jt_app see rows where user_id matches app.user_id, which the request
--   helper withUser() sets per transaction with set_config(..., true).
-- * When app.user_id is not set, app_user_id() is NULL and no rows match.
-- * jt_auth may only touch the auth tables.
-- * RLS is not FORCED: jt_owner owns the tables and must bypass RLS for
--   migrations and the two SECURITY DEFINER functions below. The app never
--   connects as jt_owner; lib/db/role-check.ts refuses to start if it does.
-- * tests/integration/rls-coverage.test.ts fails if a table with a user_id
--   column is missing from the list below.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: the current request's user id, or NULL when none is set.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

REVOKE ALL ON FUNCTION app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_user_id() TO jt_app, jt_auth;

-- ---------------------------------------------------------------------------
-- Owner-isolation policy on every user-owned table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  user_tables text[] := ARRAY[
    'stages', 'jobs', 'job_links', 'tags', 'job_tags', 'notes',
    'documents', 'job_documents', 'contacts', 'job_contacts', 'tasks',
    'notifications', 'timeline_events', 'inbox_items',
    'accounts', 'sessions', 'password_reset_tokens', 'recovery_codes'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS owner_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY owner_isolation ON %I FOR ALL TO jt_app
         USING (user_id = app_user_id())
         WITH CHECK (user_id = app_user_id())', t);
  END LOOP;

  -- Board and job tables: full read/write for the app role.
  FOREACH t IN ARRAY user_tables[1:14] LOOP
    EXECUTE format('REVOKE ALL ON %I FROM jt_app, jt_auth', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO jt_app', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Auth tables: jt_auth manages them; jt_app may only read or remove its own.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'sessions', 'password_reset_tokens', 'recovery_codes'] LOOP
    EXECUTE format('REVOKE ALL ON %I FROM jt_app, jt_auth', t);
    EXECUTE format('GRANT SELECT, DELETE ON %I TO jt_app', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO jt_auth', t);
    EXECUTE format('DROP POLICY IF EXISTS auth_manage ON %I', t);
    EXECUTE format('CREATE POLICY auth_manage ON %I FOR ALL TO jt_auth USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- users: the app sees and edits only the signed-in user's row; it can never
-- create or delete users. jt_auth handles sign-up, login and purge.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON users FROM jt_app, jt_auth;
GRANT SELECT, UPDATE ON users TO jt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO jt_auth;
DROP POLICY IF EXISTS self_only ON users;
CREATE POLICY self_only ON users FOR ALL TO jt_app
  USING (id = app_user_id()) WITH CHECK (id = app_user_id());
DROP POLICY IF EXISTS auth_manage ON users;
CREATE POLICY auth_manage ON users FOR ALL TO jt_auth USING (true) WITH CHECK (true);

-- verification_tokens has no user_id; only jt_auth may use it.
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON verification_tokens FROM jt_app, jt_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_tokens TO jt_auth;
DROP POLICY IF EXISTS auth_manage ON verification_tokens;
CREATE POLICY auth_manage ON verification_tokens FOR ALL TO jt_auth USING (true) WITH CHECK (true);

-- audit_logs: append-only. Nobody but the owner can read, change or delete.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_logs FROM jt_app, jt_auth;
GRANT INSERT ON audit_logs TO jt_app, jt_auth;
DROP POLICY IF EXISTS app_append ON audit_logs;
CREATE POLICY app_append ON audit_logs FOR INSERT TO jt_app
  WITH CHECK (user_id IS NULL OR user_id = app_user_id());
DROP POLICY IF EXISTS auth_append ON audit_logs;
CREATE POLICY auth_append ON audit_logs FOR INSERT TO jt_auth WITH CHECK (true);

-- Prisma's migration history is owner-only.
REVOKE ALL ON _prisma_migrations FROM jt_app, jt_auth;

-- ---------------------------------------------------------------------------
-- Rate limiting store (rate-limiter-flexible), used by auth flows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key varchar(255) PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  expire bigint
);
REVOKE ALL ON rate_limits FROM jt_app, jt_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO jt_app, jt_auth;

-- ---------------------------------------------------------------------------
-- B1: every new user gets the five default stages, in the same transaction
-- that creates them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_default_stages() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO stages (user_id, name, "order", color, is_default) VALUES
    (NEW.id, 'Wishlist',  0, '#8A8FA3', true),
    (NEW.id, 'Applied',   1, '#3D3BD4', true),
    (NEW.id, 'Interview', 2, '#F2B54A', true),
    (NEW.id, 'Offer',     3, '#1F7A4D', true),
    (NEW.id, 'Rejected',  4, '#B4443A', true);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION seed_default_stages() FROM PUBLIC;

DROP TRIGGER IF EXISTS users_seed_default_stages ON users;
CREATE TRIGGER users_seed_default_stages
  AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION seed_default_stages();

-- ---------------------------------------------------------------------------
-- A5: after RLS hides a row, tell the server whether that id exists at all,
-- so it can write an ACCESS_DENIED audit entry. Returns only a boolean; the
-- caller always answers 404 either way.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION row_exists(tbl text, row_id uuid) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE found boolean;
BEGIN
  IF tbl NOT IN ('stages', 'jobs', 'job_links', 'tags', 'notes', 'documents',
                 'contacts', 'tasks', 'notifications', 'timeline_events',
                 'inbox_items') THEN
    RAISE EXCEPTION 'row_exists: table % not allowed', tbl;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1)', tbl)
    INTO found USING row_id;
  RETURN found;
END $$;
REVOKE ALL ON FUNCTION row_exists(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION row_exists(text, uuid) TO jt_app;

-- ---------------------------------------------------------------------------
-- G1, G5, G6: due reminders and deadline alerts. The background worker has
-- no user id, so these SECURITY DEFINER functions do the cross-user work and
-- nothing else: each claims due rows (so they fire once), writes the in-app
-- notification for that row's owner, and returns only what the email
-- reminder needs. Only jt_auth (the worker's "no user yet" role) may call them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_due_reminders(max_rows integer)
  RETURNS TABLE (user_id uuid, title text, due_at timestamptz, kind text, link text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    UPDATE tasks t SET reminded_at = now()
    WHERE t.id IN (
      SELECT id FROM tasks
      WHERE remind_at IS NOT NULL AND remind_at <= now() AND reminded_at IS NULL AND completed_at IS NULL
      ORDER BY remind_at
      LIMIT least(greatest(max_rows, 1), 1000)
      FOR UPDATE SKIP LOCKED
    )
    RETURNING t.user_id, t.title::text, t.due_at, t.kind::text,
      CASE WHEN t.job_id IS NULL THEN '/tasks' ELSE '/jobs/' || t.job_id::text || '?tab=tasks' END AS link
  ), notified AS (
    INSERT INTO notifications (user_id, kind, title, body, link)
    SELECT d.user_id,
      CASE WHEN d.kind = 'INTERVIEW' THEN 'interview' ELSE 'task_due' END,
      left(CASE WHEN d.kind = 'INTERVIEW' THEN 'Interview: ' ELSE 'Reminder: ' END || d.title, 200),
      CASE WHEN d.due_at IS NULL THEN NULL ELSE 'Due ' || to_char(d.due_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC' END,
      d.link
    FROM due d
    RETURNING 1
  )
  SELECT d.user_id, d.title, d.due_at, d.kind, d.link FROM due d;
END $$;
REVOKE ALL ON FUNCTION claim_due_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_due_reminders(integer) TO jt_auth;

CREATE OR REPLACE FUNCTION claim_deadline_alerts(max_rows integer)
  RETURNS TABLE (user_id uuid, title text, due_at timestamptz, kind text, link text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    UPDATE jobs j SET deadline_notified_at = now()
    WHERE j.id IN (
      SELECT id FROM jobs
      WHERE deadline IS NOT NULL AND deadline_notified_at IS NULL AND archived_at IS NULL
        AND deadline <= now() + interval '2 days' AND deadline >= now() - interval '1 day'
      ORDER BY deadline
      LIMIT least(greatest(max_rows, 1), 1000)
      FOR UPDATE SKIP LOCKED
    )
    RETURNING j.user_id, (j.title || ' at ' || j.company_name)::text AS title, j.deadline AS due_at, 'DEADLINE'::text AS kind,
      '/jobs/' || j.id::text AS link
  ), notified AS (
    INSERT INTO notifications (user_id, kind, title, body, link)
    SELECT d.user_id, 'deadline', left('Deadline soon: ' || d.title, 200),
      'Applications close ' || to_char(d.due_at AT TIME ZONE 'UTC', 'DD Mon YYYY'), d.link
    FROM due d
    RETURNING 1
  )
  SELECT d.user_id, d.title, d.due_at, d.kind, d.link FROM due d;
END $$;
REVOKE ALL ON FUNCTION claim_deadline_alerts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_deadline_alerts(integer) TO jt_auth;

COMMIT;
