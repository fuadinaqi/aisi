package main

// Seed tetap memakai Prisma seed sampai port penuh selesai:
//
//	pnpm db:seed
//
// Lihat SEED.md. Binary ini sengaja no-op agar `go run ./cmd/seed` tidak menyesatkan.
import "fmt"

func main() {
	fmt.Println("Gunakan: pnpm db:pgm:seed:prod (packages/shared-pgm/prisma/seed-production.ts)")
}
