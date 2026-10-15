package middleware

import (
	"testing"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/auth"
)

func TestApplyActiveRole(t *testing.T) {
	claims := &auth.Claims{Roles: []string{"ADMIN", "PJ_SEKOLAH", "PEMBINA"}}
	if err := applyActiveRole(claims, "PEMBINA"); err != nil {
		t.Fatal(err)
	}
	if len(claims.Roles) != 1 || claims.Roles[0] != "PEMBINA" {
		t.Fatalf("peran aktif = %v", claims.Roles)
	}

	claims.Roles = []string{"ADMIN", "PEMBINA"}
	if err := applyActiveRole(claims, "  "); err != nil {
		t.Fatal(err)
	}
	if len(claims.Roles) != 2 {
		t.Fatalf("header kosong harus mempertahankan semua peran, dapat %v", claims.Roles)
	}

	if err := applyActiveRole(claims, "ANGGOTA"); err == nil {
		t.Fatal("peran yang tidak dimiliki harus ditolak")
	}
}
