#!/usr/bin/env bash
# Deploy Vite SPA + Go API
# Usage: bash deploy/deploy.sh [--seed]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED=false
if [[ "${1:-}" == "--seed" ]]; then
  SEED=true
fi

echo "==> Install JS dependencies (web-vite + shared prisma tools)"
pnpm install --frozen-lockfile || pnpm install

echo "==> DB migrate (Prisma history tetap dipakai sampai goose penuh di prod)"
pnpm db:generate
pnpm db:deploy

if [[ "$SEED" == true ]]; then
  echo "==> Seed database (first deploy only)"
  pnpm db:seed
fi

echo "==> Build Go API"
mkdir -p apps/api-go/bin
(cd apps/api-go && go build -o bin/aisi-api ./cmd/server)

echo "==> Build Vite SPA"
pnpm --filter @dakwah/web-vite build

echo "==> Restart PM2 (Go API only)"
# Bersihkan proses legacy jika masih ada di server lama
pm2 delete dakwah-web 2>/dev/null || true
pm2 delete dakwah-api 2>/dev/null || true

# Load Go env into the shell for PM2 inheritance
if [[ -f apps/api-go/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source apps/api-go/.env
  set +a
fi

if pm2 describe aisi-api &>/dev/null; then
  pm2 restart ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "Deploy selesai. Cek: curl -s http://127.0.0.1:4000/health"
echo "SPA: pastikan nginx root = $ROOT_DIR/apps/web-vite/dist"
