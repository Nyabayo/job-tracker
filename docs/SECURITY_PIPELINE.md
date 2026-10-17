# Security pipeline

Every security check runs **on your own machine**, for free, with no GitHub
Actions minutes, paid plan or payment card needed. Git hooks run them
automatically, so insecure code can't be committed or pushed by accident.

## What runs, and when

| When | Command | Checks |
| --- | --- | --- |
| Every commit (`.githooks/pre-commit`) | `npm run security:quick` | Gitleaks on the staged changes; this project's Semgrep rules and their tests |
| Every push (`.githooks/pre-push`) | `npm run verify` | ESLint with `eslint-plugin-security`, TypeScript strict typecheck, unit tests, then the full `npm run security` below |
| On demand | `npm run security` | Everything in the table below |
| On demand | `npm run test:integration` | Row-level security, cross-user access (404 + ACCESS_DENIED audit), RLS coverage of every table, database role checks. Needs Docker (Testcontainers). |
| On demand | `npm run test:e2e` | Auth flows, security headers, CSP, CSRF, accessibility (axe) at 320 to 2560px |
| On demand | `npm run security:zap` | OWASP ZAP baseline scan against the running app (`npm start` or `./scripts/selfhost.sh` first) |

The hooks are installed by `npm install` (it sets `git config core.hooksPath .githooks`).

### `npm run security`

| Check | What it catches (OWASP Top 10 2021) | Fails on |
| --- | --- | --- |
| Gitleaks | Secrets anywhere in the git history (A02, A05) | Any finding |
| Semgrep project rules (`.semgrep/job-tracker.yaml`) | Server actions missing the CSRF check or `requireUser()` (A01), raw SQL from strings (A03), `dangerouslySetInnerHTML` (A03), `Math.random` for secrets (A02), cookies without `httpOnly` (A05), forged `X-Forwarded-For` (A07), rate limits that fail open (A04), server-side `fetch` outside the SSRF-safe fetcher (A10) | Any error |
| Semgrep packs | `p/owasp-top-ten`, `p/nextjs`, `p/typescript`, `p/secrets` | Error severity |
| npm audit | Vulnerable production packages (A06) | High or critical |
| npm audit signatures | Packages not signed by the npm registry (A08) | Any bad signature |
| OSV-Scanner | Vulnerable packages, dev tools included (A06) | Any unignored vulnerability |
| Hadolint | Dockerfile mistakes (A05) | Warnings and errors |
| Trivy | Misconfigurations, secrets and vulnerable libraries in the repo (A05, A06) | Fixable high or critical |

Each tool runs from your `PATH` if installed, otherwise through Docker, so
installing Docker is enough. If a tool is neither installed nor reachable
through Docker, the check **fails** rather than being skipped. Offline, run
`SEMGREP_PACKS=off npm run security` to skip only the downloadable rule packs.

Optional native installs: `pipx install semgrep`, and Gitleaks, OSV-Scanner,
Trivy and Hadolint from their GitHub release pages or your package manager.

## Adding a Semgrep rule

Put it in `.semgrep/job-tracker.yaml` with a `ruleid:` and an `ok:` example in
`.semgrep/job-tracker.tsx`, then run `npm run security:quick`.

## Accepted findings

Each exception has a reason and an expiry date, after which the check fails again.

| Tool | Finding | Why accepted | Expires |
| --- | --- | --- | --- |
| OSV-Scanner (`osv-scanner.toml`) | `braces` GHSA-vfj7-8cjw-p6xm | Only used by development tooling, never shipped; no fixed version exists yet | 2027-01-31 |
| ZAP (`.zap/rules.tsv`) | 10111 Authentication request identified | Informational | n/a |

## Free GitHub settings worth turning on

None of these need a payment card on a public repository.

- Settings → Code security: Secret scanning and Push protection on; Private vulnerability reporting on.
- Settings → Branches: protect `main` (require a pull request, block force pushes).
