#!/usr/bin/env bash
# Smoke test API Go — Usage: bash scripts/smoke-api.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://127.0.0.1:4000}"

echo "==> Health"
curl -sf "$BASE/health" | head -c 200
echo

echo "==> Config group-levels (public)"
curl -sf "$BASE/api/v1/config/group-levels" | head -c 300
echo

echo "==> Auth login without body should fail gracefully"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/login" -H 'Content-Type: application/json' -d '{}')
echo "login empty → HTTP $CODE (expect 4xx)"

echo "==> Protected route without token"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/users/me")
echo "users/me no token → HTTP $CODE (expect 401)"

echo "Smoke dasar selesai. Lanjutkan login ber-kredensial + PARITY_MATRIX untuk regresi penuh."
