# Aplikasi Pembinaan Dakwah Depok

Monorepo full-stack untuk pendataan dan monitoring pembinaan dakwah di sekolah-sekolah Kota Depok.

## Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend:** Express.js, Prisma, JWT Auth
- **Database:** PostgreSQL 16
- **Monorepo:** pnpm + Turborepo

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

### Default Accounts (seed)

| Role | Email | Password |
|------|-------|----------|
| Superadmin | superadmin@dakwah.id | SuperAdmin123! |
| Admin | admin@dakwah.id | Admin123! |
| Pembina | pembina1@dakwah.id | Pembina123! |
| Anggota | anggota1@dakwah.id | Anggota123! |

### Test Invitations

Seed includes 3 pending invitations. Use these tokens at `/set-password?token=...`:
- `00000000-0000-4000-8000-000000000001`
- `00000000-0000-4000-8000-000000000002`
- `00000000-0000-4000-8000-000000000003`

## Project Structure

```
apps/web/          Next.js frontend
apps/api/          Express backend
packages/shared/   Zod schemas, constants, Prisma schema
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |

## Deployment

See `.github/workflows/deploy.yml` for CI/CD pipeline and `deploy/nginx.conf` for Nginx config.
