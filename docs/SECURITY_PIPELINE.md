# Security pipeline

Every pull request and every push to `main` runs the checks below. A pull request cannot merge unless all of them pass. Scheduled runs catch new vulnerabilities in code that hasn't changed.

## Checks

| Workflow | Job | What it catches | Fails the build on |
| --- | --- | --- | --- |
| `ci.yml` | Lint, types, unit tests | Code errors, unsafe patterns (`eslint-plugin-security`), type errors | Any error |
| `ci.yml` | Integration tests | Broken row-level security, cross-user access, missing policies, unsafe DB roles. Runs on a real Postgres in Testcontainers. | Any failing test |
| `ci.yml` | Production build | Build errors | Any error |
| `ci.yml` | E2E | Auth flows, security headers, CSP violations, CSRF, accessibility (axe, WCAG 2.1 AA) and layout at 320, 768, 1440 and 2560px, on Chromium, Firefox, WebKit, iPhone, Pixel and iPad, against the real Docker Compose stack | Any failing test |
| `codeql.yml` | CodeQL | Injection, XSS, path traversal and other dataflow bugs (`security-extended` queries). Also weekly. | Any alert, via code scanning |
| `security.yml` | Gitleaks | Committed secrets in the full git history | Any finding |
| `security.yml` | Semgrep CE | Default, OWASP Top 10, Next.js and TypeScript rule packs | Error-severity findings (all are uploaded to code scanning) |
| `security.yml` | OSV-Scanner | Known-vulnerable npm packages | Any unignored vulnerability |
| `security.yml` | Dependency Review | New vulnerable or wrongly licensed dependencies in a PR | High or critical severity; source-available licences (SSPL, BUSL, Elastic, Commons Clause) |
| `security.yml` | Hadolint | Dockerfile mistakes | Warnings and errors |
| `security.yml` | Trivy | Vulnerable OS packages and libraries in the built image; misconfigurations and secrets in the repo | Fixable high or critical |
| `zap.yml` | OWASP ZAP baseline | Missing headers, cookie flags, CSRF tokens, information leaks, on the running app. Also weekly. | Rules marked `FAIL` in `.zap/rules.tsv` |
| `scorecard.yml` | OpenSSF Scorecard | Repository hygiene (branch protection, pinned actions, token permissions). Weekly. | Reported, not blocking |

`security.yml` also runs daily, because new vulnerabilities are published without any code change.

## Hardening of the pipeline itself

- Every third-party action is pinned to a full commit SHA, with the version in a comment. Dependabot updates them.
- Workflows default to `permissions: read-all`; jobs only add the write permissions they need (for example `security-events: write` to upload SARIF).
- Tool binaries downloaded in CI are checked against a pinned SHA-256.
- No workflow uses `pull_request_target`, so code from forks never runs with secrets.
- Container images in `Dockerfile` and `docker-compose.yml` are pinned by digest.

## Accepted findings

Each exception has a reason and an expiry date, after which the build fails again.

| Tool | Finding | Why accepted | Expires |
| --- | --- | --- | --- |
| OSV-Scanner (`osv-scanner.toml`) | `braces` GHSA-vfj7-8cjw-p6xm | Only used by development tooling, never shipped in the image; no fixed version exists yet | 2027-01-31 |
| ZAP (`.zap/rules.tsv`) | 10111 Authentication request identified | Informational | n/a |

## Repository settings (set once by a maintainer)

These live in GitHub settings, not in code, so they must be turned on by hand.

**Settings → Code security**

- Dependency graph: on
- Dependabot alerts and Dependabot security updates: on
- Secret scanning: on
- Push protection: on
- Private vulnerability reporting: on
- Code scanning: uses the CodeQL workflow (advanced setup), not default setup

**Settings → Rules → Rulesets**, a ruleset targeting `main`:

- Restrict deletions
- Block force pushes
- Require signed commits
- Require a pull request before merging, with 1 approval, dismissing stale approvals, requiring review from Code Owners, and requiring conversation resolution
- Require status checks to pass, with branches up to date, listing every job in the table above except Scorecard
- Require code scanning results: CodeQL, blocking on high or higher

**Settings → Actions → General**

- Allow only actions pinned to a full-length commit SHA
- Workflow permissions: read repository contents only
- Do not allow GitHub Actions to create or approve pull requests
