# Staging — Vite static + Go API only

## Tujuan

Menjalankan stack produksi di lingkungan staging: **Vite SPA** + **Go API** (+ Postgres).

## Setup lokal (mirip staging)

### 1. Database

```bash
# Postgres jalan (docker compose deploy atau lokal)
pnpm db:deploy
pnpm db:seed   # sekali
```

### 2. API Go

```bash
cp deploy/env/api-go.env.example apps/api-go/.env
# edit DATABASE_URL, JWT_*, ALLOWED_ORIGIN=http://localhost:5173 untuk Vite dev
# atau ALLOWED_ORIGIN=http://localhost:4173 untuk vite preview

cd apps/api-go
go run ./cmd/server
# listen :4000
```

Pastikan `config.Load` membaca env dari environment / file `.env` (export manual jika belum ada dotenv).

### 3. Frontend Vite

**Dev (proxy ke API):**

```bash
pnpm --filter @dakwah/web-vite dev
# http://localhost:5173 — proxy /api & /uploads → :4000
```

**Preview static (lebih dekat staging):**

```bash
pnpm --filter @dakwah/web-vite build
pnpm --filter @dakwah/web-vite preview
```

Atau serve `apps/web-vite/dist` dengan Nginx memakai [`deploy/nginx.conf`](../deploy/nginx.conf).

## Keamanan staging / produksi

- **Seed production (bootstrap):** `pnpm db:seed:prod` atau `deploy.sh --seed` — hanya superadmin + sekolah + master IC/mutabaah/level. Wajib `SEED_SUPERADMIN_EMAIL` + `SEED_PASSWORD_SUPERADMIN` (≥12 karakter). Idempotent, tidak wipe.
- **Seed demo:** `pnpm db:seed` / `deploy.sh --seed-demo` — wipe + user/kelompok dummy. Dilarang jika `APP_ENV=production`.
- Pastikan `JWT_SECRET` dan `JWT_REFRESH_SECRET` kuat (≥32 karakter, bukan nilai default); API Go gagal boot di production jika misconfig.
- `ALLOWED_ORIGIN` harus origin frontend yang tepat (bukan `*`), mis. `https://binaisi.xyz` (bukan URL API).
- Produksi Opsi B: SPA `binaisi.xyz`, API `api.binaisi.xyz` — lihat `deploy/nginx.conf` + `VITE_API_URL=https://api.binaisi.xyz/api/v1`.
- Bind API Go ke localhost di belakang Nginx; jangan expose `:4000` ke publik.
- Jika staging pernah di-seed, **rotasi password** akun seed sebelum dibuka ke lebih banyak orang.
- Override opsional: `SEED_SUPERADMIN_EMAIL`, `SEED_ADMIN_EMAIL`, `SEED_PASSWORD_*`.

## Regression

1. Isi status di [`docs/PARITY_MATRIX.md`](PARITY_MATRIX.md) saat tiap endpoint/page lolos.
2. Jalankan smoke API:

```bash
bash scripts/smoke-api.sh http://127.0.0.1:4000
```

3. Jalankan E2E Playwright (lihat [`docs/E2E_MATRIX.md`](E2E_MATRIX.md)):

```bash
# API :4000 + Vite :5173 harus sudah jalan, DB sudah di-seed
pnpm test:e2e:p0
# opsional sebelum cutover:
pnpm test:e2e:p1
pnpm test:e2e:p2
```

4. Cadangan manual per role (jika Playwright belum dijalankan): SUPERADMIN, ADMIN, PJ_SEKOLAH, PEMBINA, ANGGOTA — flow: login → undangan → sekolah/kelompok → evaluasi+foto+poin → event check-in → mutabaah → IC → KKS → analytics gender.

### CI (opsional, belum blocking)

Setelah P0 stabil, tambahkan job yang: Postgres service → `pnpm db:deploy && pnpm db:seed` → build/run `api-go` → `vite preview` → `pnpm test:e2e:p0`. Jangan jadikan gate deploy sampai flaky rate rendah.

## Kriteria hijau staging

- `GET /health` OK
- Login + refresh cookie same-origin OK
- Semua baris PARITY_MATRIX API & pages = `done`
- `pnpm test:e2e:p0` hijau (atau regresi manual setara)
- Tidak ada proses PM2 selain `aisi-api` (Go)
