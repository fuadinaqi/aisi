# 🕌 PROJECT PLAN — Aplikasi Pembinaan Dakwah Depok

> Dokumen perencanaan kerja (engineering plan) untuk membangun aplikasi web full-stack
> pendataan & monitoring pembinaan dakwah di sekolah-sekolah Kota Depok.

---

## 0. Keputusan Teknis (Sudah Dikonfirmasi)

| Aspek | Keputusan | Catatan |
|---|---|---|
| Output tahap ini | **Dokumen plan saja** | Implementasi menyusul setelah plan disetujui |
| Monorepo tooling | **pnpm + Turborepo** | Workspace: `apps/*`, `packages/*` |
| Email (dev) | **Mock / console log** | Link undangan di-print ke terminal; abstraksi `EmailProvider` agar mudah ganti ke Resend di production |
| Backend | **Express.js** | Pola Controller → Service → Repository |
| Frontend | **Next.js 14 (App Router)** | Tailwind + shadcn/ui, mobile-first |
| Database | **PostgreSQL 16 + Prisma** | Lewat Docker Compose untuk dev |
| Validasi | **Zod** | Schema di-share via `packages/shared` |

---

## 1. Ringkasan Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Mobile-first)                │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────┐        ┌────────────────────────┐
│  apps/web (Next.js 14)      │        │  Object Storage         │
│  - App Router (RSC + CC)    │        │  (R2 / MinIO) — Fase 2  │
│  - TanStack Query + Zustand │        └────────────────────────┘
│  - Axios w/ interceptors    │
└───────────────┬─────────────┘
                │ REST /api/v1 (JSON, JWT)
┌───────────────▼─────────────┐
│  apps/api (Express.js)      │
│  - Controller/Service/Repo  │
│  - Auth (JWT + refresh)     │
│  - Zod validation           │
│  - EmailProvider (abstraksi)│
└───────────────┬─────────────┘
                │ Prisma
┌───────────────▼─────────────┐
│  PostgreSQL 16              │
└─────────────────────────────┘

packages/shared → Zod schemas, TypeScript types, constants, Prisma schema
```

**Prinsip kunci:**
- **Single source of truth** untuk tipe & validasi: `packages/shared` (dipakai FE & BE).
- **Separation of concern** di backend: Controller (HTTP) → Service (logika bisnis) → Repository (akses Prisma).
- **Authorization berlapis**: middleware role-check + resource-ownership check.
- **Mobile-first**: setiap halaman didesain dari 375px ke atas.

---

## 2. Struktur Monorepo (Target)

```
aisi/                                # project root
├── apps/
│   ├── web/                         # Next.js Frontend
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── set-password/
│   │   │   └── (dashboard)/...
│   │   ├── components/ (ui, layout, dashboard, kelompok, evaluasi, shared)
│   │   ├── hooks/  lib/  store/
│   │   └── package.json
│   └── api/                         # Express Backend
│       ├── src/
│       │   ├── config/              # env, cors, helmet, rate-limit
│       │   ├── middleware/          # checkAuth, checkRole, errorHandler, validate
│       │   ├── modules/             # per-domain: auth, users, schools, groups,
│       │   │                        #   evaluations, events, materi, points,
│       │   │                        #   notifications, analytics, invitations, config
│       │   │   └── <domain>/        # *.controller.ts, *.service.ts, *.repository.ts, *.routes.ts
│       │   ├── lib/                 # prisma client, jwt, email provider, storage
│       │   ├── utils/               # AppError, response helpers, week-date utils
│       │   ├── app.ts               # express app assembly
│       │   └── server.ts            # bootstrap
│       └── package.json
├── packages/
│   └── shared/
│       ├── prisma/schema.prisma     # schema + migrations
│       ├── src/
│       │   ├── schemas/             # Zod schemas per domain
│       │   ├── types/               # inferred types
│       │   └── constants/           # points.ts, roles.ts, enums.ts
│       └── package.json
├── docker-compose.yml               # postgres (+ api/web untuk full stack)
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
├── .editorconfig / .prettierrc / eslint config
└── README.md
```

**Konvensi modul backend (per domain):**
```
modules/groups/
├── groups.routes.ts        # definisi route + middleware
├── groups.controller.ts    # parsing req/res, panggil service
├── groups.service.ts       # logika bisnis + ownership check
├── groups.repository.ts    # query Prisma
└── groups.schema.ts        # (re-export dari packages/shared bila perlu)
```

---

## 3. Urutan Pengerjaan (Roadmap Bertahap)

Pengerjaan dibagi menjadi **3 fase** & **9 sprint logis**. Setiap sprint punya
*Definition of Done (DoD)* sendiri. Urutan dirancang agar dependensi terpenuhi
(fondasi dulu, baru fitur).

### 🟦 PHASE 1 — CORE

#### Sprint 0 — Fondasi Proyek (1–2 hari)
**Tujuan:** monorepo jalan, DB hidup, lint/format/CI dasar siap.
- [ ] Init `pnpm` workspace + `turbo.json` + `pnpm-workspace.yaml`.
- [ ] Setup `packages/shared` (tsconfig base, build via `tsup`/`tsc`).
- [ ] Setup `apps/api` (Express + TypeScript + ts-node-dev) skeleton `GET /health`.
- [ ] Setup `apps/web` (Next.js 14 + Tailwind + shadcn/ui init).
- [ ] `docker-compose.yml` untuk PostgreSQL 16; `.env.example`.
- [ ] ESLint + Prettier + `tsconfig` strict mode di seluruh workspace.
- [ ] Konfigurasi path alias & shared import.
- **DoD:** `pnpm dev` menjalankan web + api; `GET /health` 200; Postgres terkoneksi.

#### Sprint 1 — Database & Schema (1–2 hari)
**Tujuan:** skema Prisma final + migrasi + seed dasar.
- [ ] Tulis `schema.prisma` lengkap (semua model & enum dari spesifikasi).
- [ ] Tambahkan index sesuai kebutuhan query (weekDate, userId, groupId, schoolId).
- [ ] `prisma migrate dev` → migrasi awal.
- [ ] Prisma Client singleton di `apps/api/src/lib/prisma.ts`.
- [ ] **Seed dasar**: 1 Superadmin, GroupLevelConfig (Muda/Pratama), 30+ sekolah Depok.
- **DoD:** migrasi sukses; `prisma studio` menampilkan data seed; superadmin bisa di-query.

#### Sprint 2 — Auth System (2–3 hari)
**Tujuan:** login/logout/refresh + middleware otorisasi.
- [ ] `POST /auth/login` (bcrypt verify, terbitkan access+refresh token).
- [ ] Refresh token disimpan di tabel `RefreshToken` + HttpOnly cookie.
- [ ] `POST /auth/refresh` dengan **rotation** (invalidate token lama).
- [ ] `POST /auth/logout` (hapus refresh token).
- [ ] `POST /auth/change-password`.
- [ ] Middleware `checkAuth` (verify JWT) & `checkRole([...])`.
- [ ] Helper `requireOwnership` (pembina→kelompok, PJ→sekolah).
- [ ] Update `lastLoginAt`.
- **DoD:** login mengembalikan token; endpoint terproteksi menolak tanpa/invalid token; refresh rotation bekerja.

#### Sprint 3 — Invitation & Set-Password (2–3 hari)
**Tujuan:** seluruh flow undangan berjenjang berfungsi (tanpa registrasi publik).
- [ ] `EmailProvider` abstraksi + implementasi `ConsoleEmailProvider` (print link).
- [ ] Template HTML email undangan (string template / `react-email` opsional).
- [ ] `POST /invitations` — buat undangan (validasi hierarki role pengundang).
  - Aturan: cek email belum jadi user aktif; hanya 1 undangan PENDING/email.
- [ ] `GET /invitations` — riwayat undangan milik pengundang.
- [ ] `POST /invitations/:id/resend` — kirim ulang bila EXPIRED.
- [ ] `DELETE /invitations/:id` — batalkan undangan.
- [ ] `GET /auth/invitation/:token` (public) — validasi token, return name/email/role.
- [ ] `POST /auth/set-password` (public) — buat User (isActive), assign role+school/group, mark token USED.
- [ ] Cron/lazy check: tandai token kedaluwarsa sebagai EXPIRED.
- **DoD:** alur lengkap dari kirim undangan → buka link console → set password → login berhasil; aturan keamanan token terpenuhi.

#### Sprint 4 — Users, Schools, Groups, Members (2–3 hari)
**Tujuan:** CRUD entitas inti + role/ownership enforcement.
- [ ] Users: `GET/POST /users`, `GET/PUT /users/me`, `GET/PUT/DELETE /users/:id`.
- [ ] UserRole & UserSchool assignment.
- [ ] Schools: `GET/POST/PUT/DELETE /schools`, `GET /schools/:id/stats`.
- [ ] Groups: `GET/POST/GET:id/PUT/DELETE` + filter by sekolah & ownership.
- [ ] Members: `GET/POST/DELETE /groups/:id/members`.
- [ ] Pagination standar (default 20) untuk semua list.
- **DoD:** CRUD lengkap dengan otorisasi per role; pagination & filter berjalan.

#### Sprint 5 — Form Evaluasi & Point System (3–4 hari)
**Tujuan:** fitur inti aplikasi — evaluasi mingguan + distribusi point otomatis.
- [ ] Util normalisasi `weekDate` (Senin minggu ybs) + week-picker helper.
- [ ] `GET /evaluations` (filter groupId, weekDate), `POST /evaluations` (draft).
- [ ] `GET /evaluations/:id`, `PUT /evaluations/:id` (sebelum submit).
- [ ] `POST /evaluations/:id/submit` — finalisasi + **distribusi point (transaksi)**:
  1. Point Pembina (tepat waktu vs terlambat).
  2. Point tiap Anggota berstatus HADIR.
  3. Tulis `PointLog` + update `User.totalPoints`.
- [ ] `POST /evaluations/:id/photos` (stub dulu; storage di Fase 2).
- [ ] Constraint unik `(groupId, weekDate)` dipakai untuk load draft.
- **DoD:** submit evaluasi mendistribusikan point secara atomik & idempoten (tidak dobel saat re-submit).

#### Sprint 6 — Dashboard Inti (2–3 hari)
**Tujuan:** UI dashboard per role + integrasi FE↔BE end-to-end.
- [ ] Frontend auth flow: login page, token mgmt (`store/authStore`), axios interceptor + refresh.
- [ ] Layout dashboard (Sidebar desktop + bottom-nav mobile + RoleGuard).
- [ ] `/set-password` page (validasi token → form → redirect login).
- [ ] Dashboard Pembina: kelompok + status evaluasi + form evaluasi (`EvaluasiForm`, `AttendanceRow`).
- [ ] Dashboard PJ Sekolah: ringkasan sekolah + daftar pembina.
- [ ] Dashboard Admin/Superadmin: overview agregat dasar.
- **DoD:** user tiap role bisa login & melihat dashboard sesuai hak akses; Pembina bisa isi & submit evaluasi dari UI.

> **Milestone Phase 1 (MVP):** alur undangan → set password → login → isi evaluasi → point terdistribusi → tampil di dashboard. Aplikasi usable end-to-end.

---

### 🟨 PHASE 2 — FEATURES

#### Sprint 7 — Events, Materi, Notifikasi, Leaderboard (3–4 hari)
- [ ] Events: CRUD + `POST /events/:id/attend` (self check-in, beri point).
- [ ] Materi: CRUD per `weekDate` + publish flag.
- [ ] Notifikasi in-app: `GET /notifications`, mark read / read-all + NotifBell.
- [ ] Leaderboard: `GET /points/leaderboard` (pembina & anggota) + halaman FE.
- [ ] `GET /points/me`, `POST /points/manual` (superadmin).
- **DoD:** keempat fitur jalan FE↔BE dengan otorisasi benar.

#### Sprint 8 — File Upload & Analytics (3–4 hari)
- [ ] Object storage (Cloudflare R2 / MinIO) + Multer + validasi MIME & ukuran (≤5MB).
- [ ] Upload foto evaluasi nyata (`photoUrls`) + Next `<Image>`.
- [ ] Analytics agregat di level DB:
  - `GET /analytics/overview` (Depok), `/analytics/school/:id`, `/analytics/group/:id`.
- [ ] Charts (Recharts): tren kehadiran 8 minggu, bar per anggota, top sekolah/pembina.
- **DoD:** upload foto aman; dashboard analitik menampilkan grafik sesuai spec.

---

### 🟩 PHASE 3 — POLISH & DEPLOY

#### Sprint 9 — Hardening & Deployment (3–5 hari)
- [ ] Config label level kelompok (`GET/PUT /config/group-levels`).
- [ ] Rate limiting (`/auth/login` 5/menit; API umum 100/menit), Helmet, CORS ketat.
- [ ] Sanitasi input & audit error handling (tidak bocorkan raw DB error).
- [ ] Setup VPS (Hetzner) + Nginx (gzip) + PM2 + Certbot SSL.
- [ ] GitHub Actions CI/CD (lint → build → test → deploy via SSH).
- [ ] Monitoring dasar (PM2 logs, Nginx logs) + healthcheck.
- **DoD:** aplikasi ter-deploy dengan HTTPS, CI/CD jalan, keamanan dasar terpenuhi.

---

## 4. Estimasi Waktu

| Fase | Sprint | Estimasi |
|---|---|---|
| Phase 1 | Sprint 0–6 | ~13–20 hari kerja |
| Phase 2 | Sprint 7–8 | ~6–8 hari kerja |
| Phase 3 | Sprint 9 | ~3–5 hari kerja |
| **Total** | | **~22–33 hari kerja** (1 developer) |

> Estimasi untuk 1 developer full-time. Bisa diparalelkan (FE/BE terpisah) untuk mempercepat.

---

## 5. Detail Kontrak API (Ringkas)

Format response konsisten:
```json
{ "success": true, "data": {}, "message": "", "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

Endpoint penuh mengikuti spesifikasi (`/api/v1`): AUTH, INVITATIONS, USERS, SCHOOLS,
GROUPS, EVALUATIONS, EVENTS, MATERI, POINTS, NOTIFICATIONS, ANALYTICS, CONFIG.
Setiap endpoint divalidasi Zod (body/query/params) + middleware role + ownership.

**Matriks otorisasi** dipetakan persis ke spesifikasi role-permission (lihat tabel di prompt asli):
Superadmin > Admin > PJ Sekolah > Pembina > Anggota, dengan batasan kepemilikan resource.

---

## 6. Aturan Point System

```ts
// packages/shared/src/constants/points.ts
export const POINT_RULES = {
  PEMBINA_SUBMIT_EVALUATION: 10,
  PEMBINA_SUBMIT_EVALUATION_LATE: 5,
  PEMBINA_ATTEND_EVENT: 15,
  ANGGOTA_HADIR_PEMBINAAN: 5,
  ANGGOTA_ATTEND_EVENT: 10,
} as const;
```
- Distribusi point dijalankan dalam **transaksi Prisma** saat submit evaluasi.
- **Idempotensi**: cek `isSubmitted` agar tidak ada double-award.
- "Tepat waktu" = submit ≤ hari Minggu minggu ybs; lewat itu = LATE.

---

## 7. Keamanan (Checklist Implementasi)

- [ ] JWT access 15m, refresh 7d (HttpOnly cookie) + rotation.
- [ ] bcrypt saltRounds 12.
- [ ] Validasi Zod semua input + sanitasi string (anti-XSS).
- [ ] Token undangan UUID v4; expire 7 hari; sekali pakai; 1 PENDING/email; tolak email user aktif.
- [ ] Rate limiting login & API umum.
- [ ] Helmet (CSP/HSTS/X-Frame-Options) + CORS origin terbatas.
- [ ] Tidak expose raw DB error; AppError + global handler.
- [ ] Secrets hanya di `.env` (tidak di-commit); `.env.development` & `.env.production`.

---

## 8. Performa (Checklist)

- [ ] Index FK & kolom query-berat.
- [ ] Pagination wajib semua list (default 20).
- [ ] Prisma `select/include` spesifik (hindari over-fetch).
- [ ] TanStack Query caching + background refetch + optimistic UI (toggle kehadiran).
- [ ] Lazy load halaman (dynamic import) + skeleton loading.
- [ ] Agregasi analytics di level DB.
- [ ] gzip via Nginx; target response < 300ms.

---

## 9. Strategi Testing

| Layer | Pendekatan |
|---|---|
| Shared schemas | Unit test Zod (valid/invalid cases) |
| Backend service | Unit test logika point & otorisasi (Vitest) |
| Backend API | Integration test endpoint kunci (supertest + test DB) |
| Frontend | Component test komponen kritis + e2e happy-path (Playwright) opsional |
| Smoke | Seed → login → isi evaluasi → cek point |

Prioritas test: **auth, invitation, distribusi point** (logika paling berisiko).

---

## 10. Seed Data (Target)

- 1 Superadmin (`superadmin@dakwah.id` / `SuperAdmin123!`) — di-seed manual.
- 1 Admin (`admin@dakwah.id` / `Admin123!`) — simulasi sudah aktif.
- 30+ sekolah Depok.
- GroupLevelConfig: LEVEL_1 → "Muda", LEVEL_2 → "Pratama".
- 3 PJ Sekolah, 5 Pembina, 20 Anggota (aktif).
- 2 evaluasi pekan lalu (dengan attendance), 1 event upcoming, 2 materi pekan ini.
- 3 UserInvitation PENDING (uji halaman `/set-password`).

---

## 11. Risiko & Catatan Terbuka

| Risiko / Pertanyaan | Dampak | Rencana Mitigasi / Perlu Keputusan |
|---|---|---|
| Daftar 30+ sekolah Depok belum disediakan | Seed tidak lengkap | **Perlu data dari Anda**; sementara pakai placeholder |
| Multi-role per user (tabel UserRole) vs role tunggal | Kompleksitas otorisasi | Default: dukung multi-role, tapi UI fokus 1 role aktif |
| Definisi "tepat waktu" submit evaluasi | Salah hitung point | Default: deadline Minggu 23:59 WIB — konfirmasi bila beda |
| Email production (Resend domain & API key) | Undangan tak terkirim di prod | Disiapkan abstraksi; isi kredensial saat deploy |
| Zona waktu (WIB) untuk weekDate | Salah pengelompokan minggu | Normalisasi server ke Asia/Jakarta |
| Storage foto (R2 vs MinIO) | Biaya/operasional | Default R2 (free tier); MinIO bila ingin self-host |

---

## 12. Definition of Done (Keseluruhan Proyek)

- ✅ Semua endpoint sesuai spesifikasi dengan otorisasi & validasi.
- ✅ Alur undangan→set-password→login berfungsi penuh.
- ✅ Form evaluasi + distribusi point otomatis akurat & atomik.
- ✅ Dashboard & analytics per role sesuai spec.
- ✅ Mobile-first responsive (375px → desktop).
- ✅ Keamanan & performa checklist terpenuhi.
- ✅ Ter-deploy dengan HTTPS + CI/CD.

---

*Plan ini siap dieksekusi. Langkah berikutnya yang disarankan: mulai Sprint 0 (scaffold monorepo).*
