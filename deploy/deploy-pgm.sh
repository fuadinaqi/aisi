#!/usr/bin/env bash
# Deploy PGM (Vite SPA + Go API) tanpa me-restart AISI.
# Usage:
#   bash deploy/deploy-pgm.sh
#   bash deploy/deploy-pgm.sh --seed
#
# Sekali di server, sebelum script ini:
#   1. CREATE DATABASE pgm_db dan role pgm_user (jangan pakai aisi_db)
#   2. cp deploy/env/api-pgm.env.example apps/api-pgm/.env && edit
#   3. cp deploy/env/web-pgm.env.example apps/web-pgm/.env
#   4. DNS A pgm + api-pgm ke IP droplet
#   5. sudo cp deploy/nginx-pgm.conf /etc/nginx/sites-available/pgm
#      sudo ln -sf /etc/nginx/sites-available/pgm /etc/nginx/sites-enabled/
#      sudo nginx -t && sudo systemctl reload nginx
#      sudo certbot --nginx -d pgm.binaisi.xyz -d api-pgm.binaisi.xyz
#   6. export SEED_SUPERADMIN_EMAIL=... SEED_PASSWORD_SUPERADMIN=...
#      bash deploy/deploy-pgm.sh --seed

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEED_PROD=false
if [[ "${1:-}" == "--seed" ]]; then
  SEED_PROD=true
fi

if [[ -f apps/api-pgm/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source apps/api-pgm/.env
  set +a
fi

echo "==> Install JS dependencies"
export CI=true
if ! pnpm install --frozen-lockfile; then
  echo "WARN: frozen-lockfile gagal, install ulang tanpa freeze"
  pnpm install --force
fi

echo "==> Cek database PGM"
node packages/shared-pgm/scripts/assert-pgm-db.mjs

echo "==> DB migrate PGM"
pnpm --filter @dakwah/shared-pgm db:generate
pnpm --filter @dakwah/shared-pgm db:deploy

if [[ "$SEED_PROD" == true ]]; then
  echo "==> Seed production PGM"
  pnpm --filter @dakwah/shared-pgm db:seed:prod
fi

echo "==> Build shared (Zod) + API PGM + Vite PGM"
pnpm --filter @dakwah/shared build
mkdir -p apps/api-pgm/bin
(cd apps/api-pgm && go build -o bin/pgm-api ./cmd/server)
pnpm --filter @dakwah/web-pgm build

echo "==> Restart PM2 (pgm-api saja)"
if pm2 describe pgm-api &>/dev/null; then
  pm2 restart ecosystem.pgm.config.js --update-env
else
  pm2 start ecosystem.pgm.config.js
fi
pm2 save

echo "Deploy PGM selesai. Cek: curl -s http://127.0.0.1:4001/health"
echo "SPA: nginx root = $ROOT_DIR/apps/web-pgm/dist (server_name pgm.binaisi.xyz)"
echo "API publik: https://api-pgm.binaisi.xyz (proxy ke :4001)"
