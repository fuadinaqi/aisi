package validate

import "testing"

func TestNormalizeEmail(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"Wafa@Gmail.com", "wafa@gmail.com"},
		{"  A.B@Example.COM  ", "a.b@example.com"},
		{"sudah.kecil@mail.id", "sudah.kecil@mail.id"},
		{"", ""},
		{"   ", ""},
	}
	for _, c := range cases {
		if got := NormalizeEmail(c.in); got != c.want {
			t.Fatalf("NormalizeEmail(%q)=%q, want %q", c.in, got, c.want)
		}
	}
}
