# Job Tracker

Track every job application on one simple board, and see which CV, cover letter and job board actually get you interviews.

- **Free forever.** Only free and open-source tools. No paid APIs, no paid AI, no trackers.
- **Private.** Nobody can see anyone else's data. The database enforces it with row-level security.
- **Self-hostable.** Run your own copy with one command.
- **Mobile-first.** Built for low-end Android phones and slow mobile data.

> Status: **v1 in development, Sprint 1 (secure foundations).** Accounts, data isolation, account deletion and self-hosting work today. The board arrives in Sprint 2. See [CHANGELOG.md](CHANGELOG.md).

## Run your own copy

You need Docker with Compose v2, and `openssl`.

```sh
git clone https://github.com/Nyabayo/job-tracker.git
cd job-tracker
./scripts/selfhost.sh
```

On **Windows**, open Command Prompt or PowerShell in the folder and run this instead (no Git Bash needed):

```bat
scripts\selfhost.cmd
```

The script creates `.env` with fresh random secrets (it never overwrites an existing one) and starts everything. Then open:

- **http://localhost:3000**: Job Tracker
- **http://localhost:8025**: Mailpit, which catches the sign-up and password-reset emails until you configure real email

For a public server (HTTPS, real email, backups) read [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

### Sign in with Google or GitHub (optional)

Email and password works out of the box. To add Google or GitHub buttons, create an OAuth app with the provider, set its callback URL to `<APP_URL>/api/auth/callback/google` or `<APP_URL>/api/auth/callback/github`, and put its keys in `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` or `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`. Both are free. A button only shows when its keys are set.

## What's inside

| Part | Tool |
| --- | --- |
| App | Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, shadcn/ui-style components |
| Database | PostgreSQL 16 with row-level security, Prisma 7 |
| Accounts | Auth.js database sessions, Argon2id passwords, email verification, rate limiting with progressive lockout |
| Files | Any S3-compatible storage (SeaweedFS in Docker), private bucket |
| Virus scanning | ClamAV |
| Background jobs | pg-boss (runs on Postgres, no extra service) |
| Email | Nodemailer over SMTP (Mailpit locally) |

How the pieces fit, and how data isolation works: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Develop

```sh
npm ci
cp .env.example .env            # then set the DATABASE_URL* lines, see below
docker compose up -d postgres storage mailpit clamav
npm run db:migrate              # migrations + RLS policies, as the owner role
npm run dev
```

For local development outside Docker, set `DATABASE_URL_OWNER`, `DATABASE_URL` and `DATABASE_URL_AUTH` in `.env` to `localhost` (see the comments in `.env.example`), and point `SMTP_HOST`, `S3_ENDPOINT` and `CLAMAV_HOST` at `localhost` too.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint with Next.js and security rules |
| `npm run typecheck` | TypeScript strict |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:integration` | Real Postgres in Testcontainers, with RLS, including cross-user attacks |
| `npm run test:e2e` | Playwright against a running app (set `BASE_URL`, `MAILPIT_URL`) |
| `npm run build` | Production build |

## Security

Built against the OWASP Top 10 and ASVS Level 2. Git hooks run Semgrep, Gitleaks, npm audit, OSV-Scanner, Trivy and Hadolint locally before every commit and push, with no paid CI needed; an OWASP ZAP baseline scan is one command away. Details: [docs/SECURITY_PIPELINE.md](docs/SECURITY_PIPELINE.md).

Found a vulnerability? Please report it privately; see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

[GNU Affero General Public License v3.0](LICENSE). You may run, change and share Job Tracker freely. If you run a modified version as a public service, you must share your changes under the same licence.

Product owner: Ernest Nyabayo Osindo.
