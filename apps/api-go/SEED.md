# Seed

Staging/production seed memakai Prisma TypeScript:

```bash
pnpm db:seed
```

yang menjalankan `packages/shared/prisma/seed.ts` terhadap schema PostgreSQL yang sama.

Setelah `cmd/seed` Go siap, prefer `go run ./cmd/seed`; jaga jumlah IC (~185), sekolah, dan role identik.
