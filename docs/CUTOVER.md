# Cutover produksi — Vite + Go

Stack aktif: **Vite SPA** (`apps/web-vite`) + **Go API** (`apps/api-go`). Next.js dan Express sudah dihapus dari monorepo.

## Sebelum deploy

1. Staging hijau ([STAGING.md](STAGING.md) + [PARITY_MATRIX.md](PARITY_MATRIX.md) + [E2E_MATRIX.md](E2E_MATRIX.md)).
2. Backup DB: `bash deploy/backup-db.sh`
3. Tag release: `git tag vite-go-$(date +%Y%m%d) && git push --tags`

## Deploy

```bash
cd /opt/aisi
git pull origin main

# Env (Opsi B: SPA di root, API di subdomain)
cp deploy/env/api-go.env.example apps/api-go/.env   # ALLOWED_ORIGIN=https://binaisi.xyz
echo 'VITE_API_URL=https://api.binaisi.xyz/api/v1' > apps/web-vite/.env

bash deploy/deploy.sh

# Nginx: SPA binaisi.xyz + API api.binaisi.xyz
sudo cp deploy/nginx.conf /etc/nginx/sites-available/aisi
sudo ln -sf /etc/nginx/sites-available/aisi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d binaisi.xyz -d www.binaisi.xyz -d api.binaisi.xyz
```

PM2 hanya menjalankan `aisi-api` (Go).

## Rollback

Rollback ke commit/tag sebelumnya di git + restore DB backup jika perlu:

```bash
cd /opt/aisi
git checkout <tag-atau-commit>
bash deploy/deploy.sh
# Jika schema DB berubah: restore dari backup
# bash deploy/backup-db.sh  # cek file dump terbaru, restore manual
```

## Seed

Tetap `pnpm db:seed` sampai `cmd/seed` Go siap ([apps/api-go/SEED.md](../apps/api-go/SEED.md)).
