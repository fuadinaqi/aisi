# E2E Matrix — Playwright (`apps/web-vite`)

Stack: Vite (`:5173`) + Go API (`:4000`). Akun seed: lihat `apps/web-vite/e2e/fixtures/users.ts`.

## Perintah

```bash
# Prasyarat: API Go + Vite + DB seed
pnpm test:e2e:p0   # smoke auth + nav 5 role + nested
pnpm test:e2e:p1   # write flows F01–F20
pnpm test:e2e:p2   # ACL negatif + edge
pnpm test:e2e      # semua
pnpm --filter @dakwah/web-vite test:e2e:ui
```

## Mapping case → file

| Tag | Spec | Cakupan |
|-----|------|---------|
| `@p0` | `e2e/specs/global.setup.ts` | Health API |
| `@p0` | `e2e/specs/auth.spec.ts` | Login/logout/set-password |
| `@p0` | `e2e/specs/roles.p0.spec.ts` | Nav loop 5 role + nested sekolah/kelompok/anggota/evaluasi/config |
| `@p0` | `e2e/specs/multirole.p0.spec.ts` | Switch role UI, assign role API, accept-role undangan existing |
| `@p1` | `e2e/specs/flows.p1.spec.ts` | F01–F20 write flows |
| `@p2` | `e2e/specs/acl.p2.spec.ts` | ACL negatif, `/leaderboard`, edge blank-page |

## Status

| Area | Status |
|------|--------|
| Auth | automated `@p0` — hijau |
| Nav SUPERADMIN–ANGGOTA | automated `@p0` — hijau |
| Nested school→group→member | automated `@p0` — hijau |
| Multi-role switch / assign / accept-role | automated `@p0` — lokal |
| Write flows F01–F20 | automated `@p1` — hijau |
| ACL negatif + edge | automated `@p2` — hijau |
| CI blocking | belum — jalankan manual / lokal dulu |

## Catatan

- Console `pageerror` digagalkan kecuali noise Tiptap/devtools.
- Undangan email: Resend kosong → log console API (lokal OK).
- Check-in event: dibuat via API dengan window `now` lalu UI anggota + approve pembina.
