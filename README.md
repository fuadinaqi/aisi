# Bina AISI

Monorepo full-stack untuk pendataan, monitoring, dan evaluasi pembinaan dakwah di sekolah-sekolah Kota Depok.

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend:** Express.js, Prisma, JWT Auth
- **Database:** PostgreSQL 16
- **Monorepo:** pnpm + Turborepo

## Fitur Utama

### Peran & Akses

| Peran | Kemampuan utama |
| ----- | --------------- |
| **Superadmin / Admin** | Kelola sekolah, PJ Sekolah, kelompok, undangan admin, konfigurasi label level, analitik kota |
| **PJ Sekolah** | Kelola kelompok & pembina di sekolahnya, lihat evaluasi sekolah, analitik sekolah, buat agenda |
| **Pembina** | Isi evaluasi mingguan anggota, buat materi, kelola agenda & persetujuan check-in |
| **Anggota** | Lihat agenda sesuai level kelompok, check-in event dengan foto, lihat poin & profil |

### Modul

- **Sekolah & Kelompok** — CRUD sekolah, PJ Sekolah (multi-PJ), kelompok dengan level (`LEVEL_1` / `LEVEL_2`), undangan pembina & anggota
- **Evaluasi Mingguan** — Pembina mengisi kehadiran per pekan; create-only (409 jika sudah ada), edit via PUT; scope per kelompok/sekolah
- **Agenda & Check-in** — Event dengan target level (semua level jika kosong); anggota check-in berfoto; pembina menyetujui/menolak
- **Materi** — Upload file, link eksternal, atau rich text
- **Poin & Leaderboard** — Poin dari evaluasi tepat waktu dan check-in event yang disetujui
- **Analitik** — Ringkasan kota (admin) atau per sekolah (PJ Sekolah): kelompok, pembina, anggota, tingkat submit evaluasi, tren kehadiran
- **Notifikasi & Undangan** — Undangan email / set-password langsung; daftar undangan untuk admin

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up db -d

# Copy env files
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# Seed database
pnpm db:seed

# Start dev servers
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health

### Akun Seed

| Role | Email | Password |
| ---- | ----- | -------- |
| Superadmin | fuadinaqi@gmail.com | `!Superadmin123` |
| Admin | fuadiproject@gmail.com | `!Admin123` |
| PJ Sekolah | usamah_sman1@gmail.com (SMAN 1), naufal_sman2@gmail.com (SMAN 2), farid_sman3@gmail.com (SMAN 3) | `!Password123` |
| Pembina / Anggota | Lihat output `pnpm db:seed` | `!Password123` |

### Undangan Uji

Seed menyertakan undangan pending. Aktivasi di `/set-password?token=...`:

- `00000000-0000-4000-8000-000000000001`
- `00000000-0000-4000-8000-000000000002`
- `00000000-0000-4000-8000-000000000003`

## Project Structure

```
apps/web/          Next.js frontend (Bina AISI)
apps/api/          Express backend
packages/shared/   Zod schemas, constants, Prisma schema & migrations
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |

## Deployment

See `.github/workflows/deploy.yml` for CI/CD pipeline and `deploy/nginx.conf` for Nginx config.

## Changelog

### 2025-06-19 — Evaluasi, agenda, analitik & cache

#### Backend
- **Evaluasi:** POST create-only (409 jika pekan sudah ada); scope akses pembina (kelompok sendiri) dan PJ Sekolah (per sekolah); filter `schoolId` di list
- **Agenda:** Field `targetLevels` pada event — array kosong = semua level; filter visibility berdasarkan level kelompok user
- **Analitik:** Endpoint `/analytics/overview` untuk PJ Sekolah (scoped per sekolah) selain admin (scoped kota)
- **Media:** Helmet `crossOriginResourcePolicy: cross-origin` agar gambar upload dapat dimuat di frontend

#### Frontend
- **Evaluasi:** Infinite scroll (`EvaluationInfiniteList`) di halaman evaluasi, detail kelompok, dan detail sekolah
- **Agenda:** Form create dengan pilihan level target; tampilan cakupan level di daftar & detail event
- **PJ Sekolah:** Menu Analitik + ringkasan di dashboard
- **Kelompok:** Tampilan label level di detail kelompok
- **Cache React Query:** Helper terpusat `lib/queryInvalidation.ts` — invalidate otomatis setelah mutasi (evaluasi, agenda, materi, undangan, sekolah, kelompok, konfigurasi, notifikasi, poin/leaderboard)

#### Database
- Migration `20250619160000_event_target_levels` — kolom `targetLevels` pada tabel `Event`
