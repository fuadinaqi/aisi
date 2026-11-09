package usercred

import "testing"

func TestScanHasAccount(t *testing.T) {
	empty := ""
	secret := "x"
	mail := "a@b.c"
	if ScanHasAccount(nil, nil) {
		t.Fatal("expected false for nil")
	}
	if ScanHasAccount(&mail, nil) {
		t.Fatal("expected false for missing password")
	}
	if ScanHasAccount(&empty, &secret) {
		t.Fatal("expected false for empty email")
	}
	if !ScanHasAccount(&mail, &secret) {
		t.Fatal("expected true for paired credentials")
	}
}
