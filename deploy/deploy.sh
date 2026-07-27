#!/usr/bin/env bash
# Deploy / update aplikasi di server
# Usage: bash deploy/deploy.sh [--seed]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED=false
if [[ "${1:-}" == "--seed" ]]; then
  SEED=true
fi

echo "==> Install dependencies"
pnpm install --frozen-lockfile || pnpm install

echo "==> Generate Prisma client"
pnpm db:generate

echo "==> Run migrations (production)"
pnpm db:deploy

if [[ "$SEED" == true ]]; then
  echo "==> Seed database (first deploy only)"
  pnpm db:seed
fi

echo "==> Build"
pnpm build

echo "==> Restart PM2"
if pm2 describe dakwah-api &>/dev/null; then
  pm2 restart ecosystem.config.js
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "Deploy selesai. Cek: curl -s http://127.0.0.1:4000/health"
