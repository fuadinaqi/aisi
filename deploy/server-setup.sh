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

echo "==> Go (untuk build API di server; opsional jika binary di-upload dari CI)"
if ! command -v go &>/dev/null; then
  curl -fsSL https://go.dev/dl/go1.23.6.linux-amd64.tar.gz -o /tmp/go.tgz
  rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
fi

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
echo "  DNS Hostinger: A @ + A api → IP droplet; Resend di contact.* (opsional)"
echo "  1. Clone repo ke $APP_DIR"
echo "  2. cp deploy/env/db.env.example deploy/env/db.env && edit password"
echo "  3. cd deploy && docker compose -f docker-compose.db.yml --env-file env/db.env up -d"
echo "  4. cp deploy/env/api-go.env.example apps/api-go/.env && edit"
echo "     ALLOWED_ORIGIN=https://binaisi.xyz  APP_URL=https://binaisi.xyz"
echo "  5. echo 'VITE_API_URL=https://api.binaisi.xyz/api/v1' > apps/web-vite/.env"
echo "  6. bash deploy/deploy.sh --seed"
echo "  7. sudo cp deploy/nginx.conf /etc/nginx/sites-available/aisi"
echo "  8. sudo ln -sf /etc/nginx/sites-available/aisi /etc/nginx/sites-enabled/"
echo "  9. sudo rm -f /etc/nginx/sites-enabled/default"
echo " 10. sudo nginx -t && sudo systemctl reload nginx"
echo " 11. sudo certbot --nginx -d binaisi.xyz -d www.binaisi.xyz -d api.binaisi.xyz"
echo " Docs: docs/STAGING.md , docs/CUTOVER.md"
