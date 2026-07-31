package storage

import (
	"bytes"
	"strings"
	"testing"
)

func TestValidateMateriPDF(t *testing.T) {
	pdf := []byte("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n" + strings.Repeat("0", 64))
	r, ct, err := ValidateMateriFile(bytes.NewReader(pdf), "dokumen.pdf", int64(len(pdf)))
	if err != nil {
		t.Fatal(err)
	}
	if ct != "application/pdf" {
		t.Fatalf("ct=%s", ct)
	}
	if r == nil {
		t.Fatal("nil reader")
	}
}

func TestValidateImageRejectsHuge(t *testing.T) {
	_, _, err := ValidateImage(bytes.NewReader([]byte{0xFF, 0xD8, 0xFF}), MaxImageBytes+1)
	if err == nil {
		t.Fatal("expected error")
	}
}
