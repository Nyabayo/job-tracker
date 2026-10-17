# One-command self-hosting on Windows (PowerShell). Same as selfhost.sh:
# creates .env with fresh random secrets on first run (never overwrites an
# existing one), then builds and starts everything with Docker Compose.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Rand([int]$bytes) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  -join ($buf | ForEach-Object { $_.ToString("x2") })
}

if (-not (Test-Path ".env")) {
  $values = @{
    "AUTH_SECRET" = Rand 32
    "POSTGRES_SUPERUSER_PASSWORD" = Rand 24
    "JT_OWNER_PASSWORD" = Rand 24
    "JT_APP_PASSWORD" = Rand 24
    "JT_AUTH_PASSWORD" = Rand 24
    "S3_ACCESS_KEY" = Rand 10
    "S3_SECRET_KEY" = Rand 24
    "TOTP_ENCRYPTION_KEY" = Rand 32
  }
  $lines = Get-Content ".env.example" | ForEach-Object {
    $line = $_
    foreach ($key in $values.Keys) {
      if ($line -match "^$key=") { $line = "$key=$($values[$key])" }
    }
    $line
  }
  # UTF-8 without a byte-order mark and with LF endings, as Docker expects.
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding $false))
  Write-Host "Created .env with new random secrets."
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Job Tracker is starting at http://localhost:3000"
Write-Host "Emails (sign-up links, resets) appear at http://localhost:8025 until you set SMTP_* in .env."
