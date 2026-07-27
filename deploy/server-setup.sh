#!/usr/bin/env bash
# Setup awal VPS Ubuntu 24.04 — jalankan sebagai root atau dengan sudo
# Usage: sudo bash deploy/server-setup.sh

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="/opt/aisi"

echo "==> Update sistem"
apt-get update && apt-get upgrade -y

echo "==> Paket dasar"
apt-get install -y curl git ufw fail2ban nginx certbot python3-certbot-nginx

echo "==> User deploy (skip jika sudah ada)"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  mkdir -p "/home/$DEPLOY_USER/.ssh"
  chmod 700 "/home/$DEPLOY_USER/.ssh"
  echo "Tambahkan public key SSH ke /home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo "==> Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Fail2ban"
systemctl enable fail2ban
systemctl start fail2ban

echo "==> Node.js 20"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@9.15.0 --activate

echo "==> PM2"
npm install -g pm2

echo "==> Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$DEPLOY_USER"
fi

echo "==> Direktori aplikasi"
mkdir -p "$APP_DIR"
mkdir -p /var/backups/aisi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" /var/backups/aisi

echo ""
echo "Setup selesai. Langkah berikutnya (sebagai user $DEPLOY_USER):"
echo "  1. Clone repo ke $APP_DIR"
echo "  2. cp deploy/env/db.env.example deploy/env/db.env && edit password"
echo "  3. cd deploy && docker compose -f docker-compose.db.yml --env-file env/db.env up -d"
echo "  4. cp deploy/env/api.env.example apps/api/.env && edit"
echo "  5. cp deploy/env/web.env.example apps/web/.env.local && edit"
echo "  6. bash deploy/deploy.sh"
echo "  7. sudo cp deploy/nginx.conf /etc/nginx/sites-available/aisi"
echo "  8. sudo ln -sf /etc/nginx/sites-available/aisi /etc/nginx/sites-enabled/"
echo "  9. sudo nginx -t && sudo systemctl reload nginx"
echo " 10. sudo certbot --nginx -d app.namadomain.id"
