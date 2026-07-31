# Stop old API/Vite, start Postgres, then run Go API + Vite together.
# Usage (from repo root):
#   pwsh scripts/dev-stack.ps1
#   pwsh scripts/dev-stack.ps1 -Migrate
#   pwsh scripts/dev-stack.ps1 -NoStop

param(
  [switch]$Migrate,
  [switch]$NoStop
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $NoStop) {
  & "$PSScriptRoot\dev-stop.ps1"
}

Write-Host "==> Starting Postgres (docker compose)..."
docker compose up db -d --wait
if ($LASTEXITCODE -ne 0) {
  Write-Host "docker compose --wait failed; retrying without --wait"
  docker compose up db -d
  Start-Sleep -Seconds 3
}

if ($Migrate) {
  Write-Host "==> Running migrations..."
  pnpm db:migrate
}

Write-Host "==> API :4000  |  Vite :5173"
Write-Host "Ctrl+C stops API + Vite (DB container stays up)."
pnpm exec concurrently -k -n api,web -c blue,green `
  "pnpm dev:api" `
  "pnpm dev:web-vite"
