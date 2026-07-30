# Matriks Parity — Migrasi Vite + Go

Status: `pending` | `wip` | `done`  
**Implementasi kode (2026-07-30):** semua endpoint Go + semua page Vite sudah di-port.  
Tandai `done` hanya setelah diverifikasi di staging (lihat [STAGING.md](STAGING.md)). Default di bawah: `wip` = code ready, menunggu E2E.

## API Endpoints

| Method | Path | Domain | Status | Notes |
|--------|------|--------|--------|-------|
| GET | /health | health | wip | |
| POST | /api/v1/auth/login | auth | wip | rate 5/min |
| POST | /api/v1/auth/logout | auth | wip | |
| POST | /api/v1/auth/refresh | auth | wip | cookie rotate |
| POST | /api/v1/auth/change-password | auth | wip | |
| GET | /api/v1/auth/invitation/:token | auth | wip | |
| POST | /api/v1/auth/set-password | auth | wip | |
| * | /api/v1/invitations* | invitations | wip | full module |
| * | /api/v1/users* | users | wip | full module |
| * | /api/v1/schools* | schools | wip | full module |
| * | /api/v1/groups* | groups | wip | full module |
| * | /api/v1/evaluations* | evaluations | wip | +poin +photos |
| * | /api/v1/events* | events | wip | multipart + check-in |
| * | /api/v1/materi* | materi | wip | multipart |
| * | /api/v1/points* | points | wip | |
| * | /api/v1/notifications* | notifications | wip | |
| * | /api/v1/analytics* | analytics | wip | genderBreakdown |
| * | /api/v1/mutabaah* | mutabaah | wip | +poin submit |
| * | /api/v1/ic* | ic | wip | |
| * | /api/v1/kks* | kks | wip | Feedback model |
| * | /api/v1/config* | config | wip | |

Detail kontrak: [openapi/aisi.v1.yaml](../openapi/aisi.v1.yaml).

## Frontend Pages (apps/web-vite)

Semua path inventaris (login, dashboard, schools, kelompok, events, materi, evaluasi, mutabaah, IC, KKS, analytics, config, …) status **`wip`** — code ported, menunggu E2E staging.

## Critical logic checklist

- [x] JWT access + refresh cookie rotate (implemented in Go)
- [x] INVITATION_RULES + POINT_RULES (constants package)
- [x] Gender Ikhwan/Akhwat constraints (schools/groups)
- [x] Rate limit login 5/min, API 100/min
- [x] Envelope `{ success, data, message?, pagination? }`
- [x] Multipart uploads (evaluasi/events/materi)
- [x] RoleGuard + Sidebar navByRole (Vite)
- [ ] E2E staging per role verified
- [ ] Production cutover completed
