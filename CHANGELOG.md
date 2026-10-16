# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Sprints 2 to 4: the MVP

#### Added

- Kanban board with drag and drop by mouse, touch and keyboard, a "Move to" menu, undo, phone stage tabs, filters, search, sort and archive (B1 to B6).
- Job details with overview, description, documents, contacts, tasks, notes and timeline tabs (C1, C3 to C6).
- Import a job from a link, with an SSRF guard that pins the checked IP, re-checks redirects and caps time and size (C2).
- Document uploads checked by magic bytes, size and ClamAV before storage, and served with nosniff and a sandbox CSP (D1).
- Tasks page, due-task and deadline reminders, in-app notifications and optional reminder emails (E1, E2).
- Dashboard with response rate, applications per week and stage funnel (F1).
- Follow-up nudge after 7 days in Applied (G2), theme and currency preferences, and JSON or CSV export with spreadsheet formula neutralising (L3).
- Rich text in descriptions is reduced to an allow-list and rendered without `dangerouslySetInnerHTML`.

#### Changed

- Every security check now runs locally through `npm run security` and git hooks instead of GitHub Actions: Gitleaks, Semgrep (project rules plus the OWASP Top 10, Next.js, TypeScript and secrets packs), npm audit, OSV-Scanner, Hadolint, Trivy and an optional ZAP baseline.
- New Semgrep rule blocks server-side `fetch` outside the SSRF guard.

#### Not yet built

- Google and GitHub sign-in (A2), TOTP two-factor (A4), the ZIP export of files and the desktop side panel for job details.

### Sprint 1: secure foundations

#### Added

- Project docs, AGPL-3.0 licence, security policy, contributing guide and code of conduct.
- Docker Compose stack (app, PostgreSQL 16, SeaweedFS S3 storage, ClamAV, Mailpit) and `scripts/selfhost.sh` for one-command self-hosting.
- CI: lint, type checks, unit, integration and end-to-end tests on six browser profiles, accessibility checks, CodeQL, Semgrep, Gitleaks, OSV-Scanner, Dependency Review, Trivy, Hadolint, OWASP ZAP baseline and OpenSSF Scorecard.
- Prisma schema for every v1 model, with row-level security, three database roles and an append-only audit log (A5).
- Sign up with email verification (A1), login with rate limiting and progressive lockout, password reset (A3), and account deletion with a background purge of all data and files (A7).
- Privacy page (L5).
- Design tokens, light and dark themes, and the responsive app shell (sidebar, top bar, bottom tabs).
