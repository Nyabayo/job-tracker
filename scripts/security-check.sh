#!/usr/bin/env bash
# Local security pipeline (replaces the old GitHub Actions workflows, so every
# check runs on your own machine for free). Runs automatically before every
# push via .githooks/pre-push, and on demand with `npm run security`.
#
# Each tool is used from your PATH if installed, otherwise through Docker.
# If neither is available the check FAILS: security checks never skip silently.
#
#   --quick   only the fast checks (used by the pre-commit hook)
set -euo pipefail
cd "$(dirname "$0")/.."

QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

GITLEAKS_IMAGE="zricethezav/gitleaks:v8.28.0"
SEMGREP_IMAGE="semgrep/semgrep:1.140.0"
OSV_IMAGE="ghcr.io/google/osv-scanner:v2.2.3"
TRIVY_IMAGE="aquasec/trivy:0.67.2"
HADOLINT_IMAGE="hadolint/hadolint:v2.14.0"

failed=()
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { failed+=("$1"); printf '\033[31mFAILED: %s\033[0m\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }
docker_ok() { have docker && docker info >/dev/null 2>&1; }

# run_tool <name> <docker image> <args...>: native binary first, then Docker.
# Images whose entrypoint is not the tool itself get the tool name prepended.
run_tool() {
  local name="$1" image="$2"; shift 2
  if have "$name"; then
    "$name" "$@"
  elif docker_ok; then
    case "$name" in
      semgrep|hadolint) docker run --rm -v "$PWD:/src" -w /src "$image" "$name" "$@" ;;
      *) docker run --rm -v "$PWD:/src" -w /src "$image" "$@" ;;
    esac
  else
    echo "$name is not installed and Docker is not running. Install $name (see docs/SECURITY_PIPELINE.md)."
    return 127
  fi
}

# --- Secrets -----------------------------------------------------------------
if [[ $QUICK == 1 ]]; then
  step "Gitleaks: staged changes"
  run_tool gitleaks "$GITLEAKS_IMAGE" git --staged --redact --no-banner . || fail "gitleaks (staged)"
else
  step "Gitleaks: full git history"
  run_tool gitleaks "$GITLEAKS_IMAGE" git --redact --no-banner . || fail "gitleaks"
fi

# --- Static analysis ---------------------------------------------------------
step "Semgrep: project rule tests"
run_tool semgrep "$SEMGREP_IMAGE" --test --config .semgrep/job-tracker.yaml .semgrep/job-tracker.tsx || fail "semgrep rule tests"

step "Semgrep: project security rules (CSRF, auth, SQL, XSS, SSRF, cookies)"
run_tool semgrep "$SEMGREP_IMAGE" scan --config .semgrep/job-tracker.yaml --exclude .semgrep --metrics off --error --quiet || fail "semgrep project rules"

if [[ $QUICK == 1 ]]; then
  [[ ${#failed[@]} -eq 0 ]] && exit 0
  printf '\n\033[31mSecurity checks failed: %s\033[0m\n' "${failed[*]}"; exit 1
fi

step "Semgrep: OWASP Top 10, Next.js, TypeScript and secrets packs"
# The packs download from the Semgrep registry. Set SEMGREP_PACKS=off only
# when you are offline; the project rules above still run.
if [[ "${SEMGREP_PACKS:-on}" != "off" ]]; then
  run_tool semgrep "$SEMGREP_IMAGE" scan --metrics off --error --quiet \
    --config p/owasp-top-ten --config p/nextjs --config p/typescript --config p/secrets \
    --exclude tests --exclude .semgrep --exclude lib/generated . || fail "semgrep packs"
fi

# --- Dependencies (A06) --------------------------------------------------------
step "npm audit: production dependencies (high or critical)"
npm audit --omit=dev --audit-level=high || fail "npm audit"

step "npm audit signatures: every package signed by the registry"
npm audit signatures || fail "npm audit signatures"

step "OSV-Scanner: all dependencies"
run_tool osv-scanner "$OSV_IMAGE" scan source --config osv-scanner.toml --lockfile package-lock.json || fail "osv-scanner"

# --- Containers ----------------------------------------------------------------
step "Hadolint: Dockerfile"
run_tool hadolint "$HADOLINT_IMAGE" Dockerfile || fail "hadolint"

step "Trivy: repository misconfigurations, secrets and vulnerable libraries"
run_tool trivy "$TRIVY_IMAGE" fs --quiet --scanners vuln,misconfig,secret --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --skip-dirs node_modules --skip-dirs .next . || fail "trivy"

if [[ ${#failed[@]} -gt 0 ]]; then
  printf '\n\033[31mSecurity checks failed: %s\033[0m\n' "${failed[*]}"
  exit 1
fi
printf '\n\033[32mAll security checks passed.\033[0m\n'
