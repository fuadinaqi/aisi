package config

import (
	"strings"
	"testing"
)

func TestLoadRejectsAISIDatabase(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://pgm_user:secret@127.0.0.1:5432/aisi_db")
	t.Setenv("APP_ENV", "development")
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "aisi_db") {
		t.Fatalf("API PGM harus menolak aisi_db, dapat: %v", err)
	}
}

func TestLoadRejectsLocalAISIDatabase(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://dakwah_user:dakwah_pass@127.0.0.1:5432/dakwah_db")
	t.Setenv("APP_ENV", "development")
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "dakwah_db") {
		t.Fatalf("API PGM harus menolak dakwah_db, dapat: %v", err)
	}
}

func TestLoadAllowsPgmDatabase(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgresql://pgm_user:secret@127.0.0.1:5432/pgm_db")
	t.Setenv("APP_ENV", "development")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseName != "pgm_db" {
		t.Fatalf("nama database = %q", cfg.DatabaseName)
	}
	if cfg.Port != "4001" {
		t.Fatalf("port = %q", cfg.Port)
	}
}
