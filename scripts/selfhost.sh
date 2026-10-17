#!/bin/sh
# One-command self-hosting: creates .env with fresh random secrets on first
# run (never overwrites an existing one), then builds and starts everything.
set -eu
cd "$(dirname "$0")/.."

rand() { openssl rand -hex "$1"; }

if [ ! -f .env ]; then
  sed \
    -e "s/^AUTH_SECRET=.*/AUTH_SECRET=$(rand 32)/" \
    -e "s/^POSTGRES_SUPERUSER_PASSWORD=.*/POSTGRES_SUPERUSER_PASSWORD=$(rand 24)/" \
    -e "s/^JT_OWNER_PASSWORD=.*/JT_OWNER_PASSWORD=$(rand 24)/" \
    -e "s/^JT_APP_PASSWORD=.*/JT_APP_PASSWORD=$(rand 24)/" \
    -e "s/^JT_AUTH_PASSWORD=.*/JT_AUTH_PASSWORD=$(rand 24)/" \
    -e "s/^S3_ACCESS_KEY=.*/S3_ACCESS_KEY=$(rand 10)/" \
    -e "s/^S3_SECRET_KEY=.*/S3_SECRET_KEY=$(rand 24)/" \
    -e "s/^TOTP_ENCRYPTION_KEY=.*/TOTP_ENCRYPTION_KEY=$(rand 32)/" \
    .env.example > .env
  chmod 600 .env
  echo "Created .env with new random secrets."
fi

docker compose up -d --build
echo "Job Tracker is starting at $(grep '^APP_URL=' .env | cut -d= -f2-)"
echo "Emails (sign-up links, resets) appear at http://localhost:8025 until you set SMTP_* in .env."
