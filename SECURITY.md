# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting). Include what you found, how to reproduce it, and what an attacker could do with it.

What to expect:

- An acknowledgement within 3 working days.
- An assessment and a planned fix date within 10 working days.
- Credit in the release notes, if you want it.

We ask that you give us 90 days to fix an issue before you publish details, and that you only test against your own self-hosted copy, never someone else's.

## Supported versions

Only the latest release on `main` gets security fixes.

## What we protect against

Job Tracker is built against the OWASP Top 10 (2021) and OWASP ASVS Level 2. The table shows where each risk is handled.

| OWASP risk | How Job Tracker handles it |
| --- | --- |
| A01 Broken access control | Postgres row-level security on every user-owned table; the app's database role cannot bypass it and refuses to start if it could. Cross-user lookups return 404 and are audited. Composite foreign keys stop one user's rows from pointing at another's. |
| A02 Cryptographic failures | Argon2id passwords. Email and reset tokens are random 256-bit values stored only as SHA-256 hashes. HSTS and Secure cookies over HTTPS. Files live in a private bucket. |
| A03 Injection | Prisma parameterised queries only; zod validation on every server action; strict CSP with a per-request nonce; HTML in emails is escaped. |
| A04 Insecure design | Threat-model notes in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); separate database roles for migrations, the app and login; account deletion is a two-step purge. |
| A05 Security misconfiguration | Strict security headers, no `X-Powered-By`, non-root read-only container with all capabilities dropped, secrets only from environment, startup env validation. |
| A06 Vulnerable components | Exact-pinned dependencies, Dependabot, OSV-Scanner, npm audit with registry signature checks, Dependency Review, Trivy, and SHA-pinned GitHub Actions checked by zizmor. |
| A07 Identification and authentication failures | Generic login errors, timing-equalised password checks, rate limits and progressive lockout, verified email, single-use 30-minute reset links, session rotation on login and revocation on password reset. |
| A08 Software and data integrity failures | CSRF protection (Origin check plus double-submit token), lockfile installs, signed commits required on `main`, CodeQL and Semgrep (including this project's own rules in `.semgrep/`) on every PR. |
| A09 Logging and monitoring failures | Append-only audit log of logins, failures, lockouts, resets, access denials and deletions; IPs are truncated. |
| A10 Server-side request forgery | The server never fetches user-supplied URLs; Nodemailer file and URL access are disabled. |

The full pipeline is described in [docs/SECURITY_PIPELINE.md](docs/SECURITY_PIPELINE.md).
