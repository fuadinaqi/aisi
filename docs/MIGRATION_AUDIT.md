# Audit migrasi Go — temuan & perbaikan (2026-07-30)

## Bug yang menyebabkan PJ/kelompok kosong di detail sekolah

**Root cause:** di `schools/handlers.go` `detail`, query SQL memakai `$1` tetapi **argumen `sid` tidak dikirim** ke `Query` → error `expected 1 arguments, got 0`. Error sebelumnya ditelan (`if err == nil`), sehingga FE menerima `pjUsers: []`, `groups: []`, `totalGroups: 0` padahal data seed ada.

**Status:** sudah diperbaiki + error DB tidak lagi di-swallow.

## Perbaikan lain dari audit mendalam

| Area | Masalah | Status |
|------|---------|--------|
| Events list (ADMIN) | Placeholder `$3/$4/$5` hardcode padahal admin punya 0 filter args | Fixed (indeks dinamis) |
| Users list/me | `roles` sebagai `string[]`, `schools` flat — FE expect `{role}` dan `{school:{id,name}}` | Fixed |
| Groups/schools create JSON | Struct tag rusak (`json:"schoolId"` / `json:"pembinaId"` di semua field) | Fixed |
| Group member detail | Kurang nested `group` + `school` | Fixed |
| Evaluations list/detail | `attendances` / `group` kurang; pagination pakai `meta` | Fixed sebelumnya |
| Events pending check-in | Nested `user`/`event`/`group` kurang | Fixed sebelumnya |
| Pagination envelope | `meta` vs `pagination` | Fixed ke `pagination` |

## Yang masih disengaja / residual

- Seed tetap `pnpm db:seed` (bukan Go seed penuh) — lihat `apps/api-go/SEED.md`
- Next.js / Express sudah dihapus dari monorepo (stack: Vite + Go)
- Attendance stats di **group detail** (rate per kelompok) masih bisa diperkaya
- E2E Playwright: lihat [E2E_MATRIX.md](E2E_MATRIX.md)

## Cara verifikasi lokal

1. Restart API Go (wajib):
   ```bash
   # Ctrl+C di terminal go run, lalu:
   cd apps/api-go && go run ./cmd/server
   ```
2. Hard refresh `/schools/<id>` — harus muncul PJ + 3 kelompok seed.
3. Cek juga: Users, Events (sebagai SUPERADMIN), detail anggota kelompok.
