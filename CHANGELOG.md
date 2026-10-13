# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Sprint 1: secure foundations

#### Added

- Project docs, AGPL-3.0 licence, security policy, contributing guide and code of conduct.
- Docker Compose stack (app, PostgreSQL 16, SeaweedFS S3 storage, ClamAV, Mailpit) and `scripts/selfhost.sh` for one-command self-hosting.
- CI: lint, type checks, unit, integration and end-to-end tests on six browser profiles, accessibility checks, CodeQL, Semgrep, Gitleaks, OSV-Scanner, Dependency Review, Trivy, Hadolint, OWASP ZAP baseline and OpenSSF Scorecard.
- Prisma schema for every v1 model, with row-level security, three database roles and an append-only audit log (A5).
- Sign up with email verification (A1), login with rate limiting and progressive lockout, password reset (A3), and account deletion with a background purge of all data and files (A7).
- Privacy page (L5).
- Design tokens, light and dark themes, and the responsive app shell (sidebar, top bar, bottom tabs).
