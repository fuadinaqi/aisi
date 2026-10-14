package storage

import "testing"

func TestDisplayFilename(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"Surat Abasa 1-16.pdf", "Surat Abasa 1-16.pdf"},
		{`C:\Users\foo\Surat Abasa 1-16.pdf`, "Surat Abasa 1-16.pdf"},
		{"../../../etc/passwd", "passwd"},
		{"", "file"},
		{".", "file"},
		{"  foto.PNG  ", "foto.PNG"},
	}
	for _, c := range cases {
		if got := DisplayFilename(c.in); got != c.want {
			t.Fatalf("DisplayFilename(%q)=%q want %q", c.in, got, c.want)
		}
	}
}

func TestReplaceExt(t *testing.T) {
	if got := ReplaceExt("foto.PNG", ".jpg"); got != "foto.jpg" {
		t.Fatalf("got %q", got)
	}
	if got := ReplaceExt("foto", "jpg"); got != "foto.jpg" {
		t.Fatalf("got %q", got)
	}
}

func TestContentDisposition(t *testing.T) {
	ascii := ContentDisposition("attachment", "notes.pdf")
	if ascii != `attachment; filename="notes.pdf"` {
		t.Fatalf("ascii: %q", ascii)
	}
	spaced := ContentDisposition("attachment", "Surat Abasa 1-16.pdf")
	if spaced != `attachment; filename="Surat_Abasa_1-16.pdf"; filename*=UTF-8''Surat%20Abasa%201-16.pdf` {
		t.Fatalf("spaced: %q", spaced)
	}
}
