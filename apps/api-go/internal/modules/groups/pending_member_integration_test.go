//go:build integration

package groups

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/auth"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/domain/usercred"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Jalankan: go test -tags=integration ./internal/modules/groups/... -count=1
// Butuh DATABASE_URL (schema sudah dimigrasi pending_member_credentials).

func TestPendingMemberDirectAndInviteFlow(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL kosong")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	var groupID, gender string
	err = pool.QueryRow(ctx, `
		SELECT g."id", g."gender"::text
		FROM "Group" g
		WHERE g."isActive"
		LIMIT 1`).Scan(&groupID, &gender)
	if err != nil {
		t.Skip("tidak ada kelompok aktif di DB")
	}

	stamp := time.Now().UnixNano()
	name := "IT Pending " + uuid.NewString()[:8]
	uid := uuid.NewString()
	mid := uuid.NewString()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO "User" ("id","name","phone","gender","updatedAt") VALUES ($1,$2,NULL,$3::"Gender",NOW())`, uid, name, gender)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'ANGGOTA')`, uuid.NewString(), uid)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO "GroupMember" ("id","groupId","userId","isActive") VALUES ($1,$2,$3,true)`, mid, groupID, uid)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM "GroupMember" WHERE "userId"=$1`, uid)
		_, _ = pool.Exec(ctx, `DELETE FROM "UserRole" WHERE "userId"=$1`, uid)
		_, _ = pool.Exec(ctx, `DELETE FROM "UserInvitation" WHERE "targetUserId"=$1`, uid)
		_, _ = pool.Exec(ctx, `DELETE FROM "User" WHERE "id"=$1`, uid)
	})

	has, err := usercred.HasAccountByID(ctx, pool, uid)
	if err != nil || has {
		t.Fatalf("hasAccount expected false, got %v err=%v", has, err)
	}

	email := "it.pending." + uuid.NewString()[:8] + "@example.com"
	hash, err := auth.HashPassword("!Password123")
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `UPDATE "User" SET "email"=$1,"password"=$2,"updatedAt"=NOW() WHERE "id"=$3`, email, hash, uid)
	if err != nil {
		t.Fatal(err)
	}
	has, _ = usercred.HasAccountByID(ctx, pool, uid)
	if !has {
		t.Fatal("expected hasAccount true after direct update")
	}
}
