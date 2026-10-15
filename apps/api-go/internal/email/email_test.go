package email

import (
	"strings"
	"testing"
)

func TestInvitationEmailRendersCard(t *testing.T) {
	url := "https://binaisi.example/set-password?token=abc&next=1"
	html := renderEmail(aisiTheme, content{
		Preheader: "Atur password untuk mengaktifkan akun.",
		Eyebrow:   "Undangan akun",
		Heading:   "Anda diundang bergabung",
		Greeting:  greeting("Aisyah <admin>"),
		Body:      "Ada tempat untuk Anda di Bina AISI.",
		Action:    "Atur password",
		URL:       url,
		Note:      "Tautan ini hanya untuk Anda.",
		Footer:    "Bina AISI Kota Depok.",
	})

	for _, want := range []string{
		"Bina AISI",
		"Anda diundang bergabung",
		"Atur password",
		"#1D865F",
		"Assalamu&#39;alaikum Aisyah &lt;admin&gt;,",
		"https://binaisi.example/set-password?token=abc&amp;next=1",
		"border-radius:12px",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("html missing %q", want)
		}
	}
	if strings.Contains(html, "<admin>") {
		t.Fatal("name was not escaped")
	}
	if strings.Contains(html, "ZgotmplZ") {
		t.Fatal("template stripped a safe value")
	}
	if !strings.Contains(html, "<!--[if mso]>") {
		t.Fatal("outlook width guard was stripped")
	}
}

func TestInvitationRejectsScriptURL(t *testing.T) {
	html := renderEmail(aisiTheme, content{
		Heading: "Undangan",
		URL:     "javascript:alert(1)",
		Action:  "Atur password",
	})
	if !strings.Contains(html, "#ZgotmplZ") {
		t.Fatal("javascript URL was not neutralized")
	}
}
