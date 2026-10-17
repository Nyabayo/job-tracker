#!/usr/bin/env bash
# OWASP ZAP baseline scan against a running app (default http://localhost:3000).
# Start the stack first: ./scripts/selfhost.sh  (or npm run build && npm start)
# Fails on any rule marked FAIL in .zap/rules.tsv.
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-http://localhost:3000}"
docker run --rm --network host -v "$PWD/.zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t "$TARGET" -c rules.tsv -I -j
