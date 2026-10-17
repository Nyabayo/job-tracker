# Self-hosting

## Quick start (your own computer)

```sh
git clone https://github.com/Nyabayo/job-tracker.git
cd job-tracker
./scripts/selfhost.sh
```

Open http://localhost:3000. Emails appear in Mailpit at http://localhost:8025.

The script writes `.env` with random secrets (file mode 600) the first time and never overwrites it. Keep `.env` safe and out of git.

## What runs

| Service | Image | Notes |
| --- | --- | --- |
| `postgres` | PostgreSQL 16 | Data volume `pgdata`. Creates the three roles on first start. |
| `migrate` | the app image | Runs migrations and RLS policies, then exits. The app waits for it. |
| `app` | the app image | Non-root, read-only filesystem, all Linux capabilities dropped. Listens on `127.0.0.1:3000`. |
| `storage` | SeaweedFS | S3-compatible file storage, volume `s3data`. Not exposed to the host. |
| `clamav` | ClamAV | Virus scanning; downloads signatures on first start (a few minutes). |
| `mailpit` | Mailpit | Catches outgoing email for testing. Remove it once real SMTP is set up. |

All images are pinned to exact versions and digests, and Dependabot proposes updates.

## Putting it on the internet

1. **Use HTTPS.** Put a reverse proxy such as Caddy or nginx in front of port 3000. With Caddy:

   ```
   jobs.example.com {
     reverse_proxy 127.0.0.1:3000
   }
   ```

2. Set in `.env`:

   ```
   APP_URL=https://jobs.example.com
   TRUST_PROXY=true
   ```

   `https://` turns on Secure cookies and HSTS. Only set `TRUST_PROXY=true` when exactly one proxy you control sits in front of the app and appends the client address to `X-Forwarded-For` (Caddy and nginx's `$proxy_add_x_forwarded_for` both do). The app reads the last entry, the one your proxy added; otherwise anyone could fake their IP and dodge rate limits. With `TRUST_PROXY=false` the per-IP limits on sign-up and password reset become one shared limit for the whole site, and login relies on per-account lockout only.

3. **Real email.** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM` for your mail provider, then remove the `mailpit` service.

4. Apply changes with `docker compose up -d`.

The app port is bound to `127.0.0.1` on purpose, so only your reverse proxy can reach it.

## Backups

Back up the database and the files together:

```sh
docker compose exec -T postgres pg_dump -U postgres -Fc jobtracker > jobtracker-$(date +%F).dump
docker run --rm -v job-tracker_s3data:/data -v "$PWD":/backup alpine tar czf /backup/files-$(date +%F).tgz -C /data .
```

Store backups encrypted and off the server. Restore with `pg_restore` and by unpacking the archive into the volume while the stack is stopped.

## Updating

```sh
git pull
docker compose up -d --build
```

Migrations run automatically before the app starts.

## Health check

`GET /api/health` returns `{"status":"ok"}`. Docker uses it, and you can point an uptime monitor at it.
