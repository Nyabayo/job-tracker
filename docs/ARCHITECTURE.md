# Architecture

## The pieces

```
Browser ──HTTPS──> reverse proxy (yours) ──> app (Next.js, port 3000)
                                              │
              ┌───────────────┬───────────────┼──────────────┬──────────────┐
              ▼               ▼               ▼              ▼              ▼
         PostgreSQL 16    S3 storage       ClamAV        SMTP server    pg-boss jobs
        (data, sessions,  (SeaweedFS,     (virus scan,   (Mailpit in    (inside the app,
         rate limits,      private bucket) Sprint 3)      development)   stored in Postgres)
         job queue)
```

- **app**: one Next.js 16 server (App Router, React Server Components, server actions). It also runs the background job workers, so there is no separate worker service.
- **PostgreSQL** holds everything except files: user data, Auth.js sessions, the rate-limit counters and the pg-boss job queue (schema `pgboss`).
- **S3 storage** holds uploaded files under `users/<userId>/<random>`. The bucket is private; downloads will go through short-lived signed URLs after an ownership check (Sprint 3).
- **ClamAV** scans every upload before it is stored (Sprint 3).

## Code layout

| Path | What lives there |
| --- | --- |
| `app/(auth)` | Sign up, login, verification, password reset pages and their server actions |
| `app/(app)` | Signed-in pages inside the app shell (board, dashboard, tasks, settings) |
| `app/api` | Auth.js route and `/api/health` |
| `components` | UI primitives (`ui/`), the app shell (`layout/`), auth forms, CSRF provider |
| `lib/db` | Prisma clients, `withUser()`, the startup role check, ownership helpers |
| `lib/auth` | Passwords, tokens, lockout, sessions, Auth.js config |
| `lib/security` | CSP, HSTS, CSRF |
| `lib/jobs` | pg-boss setup and the account purge job |
| `prisma` | Schema, migrations, `roles.sql` (database roles) and `rls.sql` (policies) |
| `proxy.ts` | Runs before every request: cross-site write check, CSRF cookie, nonce CSP, HSTS |

## Data isolation (A5)

The database, not just the app code, decides who sees what.

**Three database roles**, created by `prisma/roles.sql`:

| Role | Used by | Can do |
| --- | --- | --- |
| `jt_owner` | `npm run db:migrate` only | Owns the tables. Never used by the running app. |
| `jt_app` | All signed-in data access | Reads and writes user data, filtered by row-level security. Cannot create users, read tokens, read the audit log, or turn RLS off. |
| `jt_auth` | Sign-up, login, reset, purge | Only the auth tables (`users`, `sessions`, tokens) and appending to the audit log. Cannot read jobs, files or contacts. |

**How a request is scoped:** server code calls `withUser(userId, fn)`. That opens a transaction, runs `set_config('app.user_id', userId, true)` and then `fn`. Every policy in `prisma/rls.sql` is `user_id = app_user_id()`, so rows of other users are invisible, and inserts or updates with someone else's `user_id` are rejected. If no user is set, nothing matches.

**Belt and braces:**

- Child tables use composite foreign keys `(parent_id, user_id) → parent(id, user_id)`, so even a bug can't link your job to someone else's stage, contact or document.
- At startup the app checks that its two runtime roles are not superusers, have no `BYPASSRLS`, and don't own the tables. It refuses to start otherwise.
- When a lookup by id finds nothing, `ownedOrNull()` asks the `row_exists()` function whether the id exists at all. If it does, the request was for another user's row: the app writes an `ACCESS_DENIED` audit entry and still answers 404.
- `tests/integration/rls-coverage.test.ts` fails if any table with a `user_id` column has no policy, and `isolation.test.ts` runs cross-user read, write, insert and link attacks on every release.

## Authentication

- Passwords: Argon2id (19 MiB, 2 iterations), 12 to 128 characters. Unknown emails still run a dummy hash so timing doesn't reveal which accounts exist.
- Sessions: Auth.js database sessions, 7 days, HttpOnly, SameSite=Lax, `__Secure-` prefixed over HTTPS. A new session replaces the old one at login; a password reset ends all sessions.
- Tokens for email verification (24 hours) and password reset (30 minutes, single use) are 256-bit random values. Only their SHA-256 hashes are stored.
- Rate limits live in Postgres: per IP on login and sign-up, per email on resets and verification resends. After 5 failed logins an account is locked for 60 seconds, doubling each time up to an hour.

## Account deletion (A7)

1. The user confirms with their password and the word DELETE.
2. In one transaction the account is marked deleted and all sessions are removed, so it is unusable immediately.
3. A pg-boss job deletes every file under `users/<id>/`, then the user row; all their data goes with it through `ON DELETE CASCADE`. An anonymised `ACCOUNT_DELETED` audit entry remains.
4. An hourly sweep re-queues any account still marked deleted, so nothing is left behind if a job failed. Deletion completes within 24 hours, normally within seconds.

## Request security

- **CSP** with a fresh nonce per request for scripts and styles; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`.
- **CSRF:** `proxy.ts` rejects cross-site writes using `Origin` and `Sec-Fetch-Site`, and every form also carries a double-submit token that each server action checks in constant time.
- Other headers: HSTS (HTTPS only), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
