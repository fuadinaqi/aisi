package email

import (
	"strings"
	"testing"
)

func TestInvitationEmailRendersCard(t *testing.T) {
	url := "https://genmuda.example/set-password?token=abc&next=1"
	html := renderEmail(pgmTheme, content{
		Preheader: "Atur password untuk mengaktifkan akun.",
		Eyebrow:   "Undangan akun",
		Heading:   "Anda diundang bergabung",
		Greeting:  greeting("Aisyah <admin>"),
		Body:      "Ada tempat untuk Anda di Pembinaan Generasi Muda.",
		Action:    "Atur password",
		URL:       url,
		Note:      "Tautan ini hanya untuk Anda.",
		Footer:    "Pembinaan Generasi Muda.",
	})

	for _, want := range []string{
		"Gen Muda",
		"Anda diundang bergabung",
		"Atur password",
		"#2F4874",
		"Assalamu&#39;alaikum Aisyah &lt;admin&gt;,",
		"https://genmuda.example/set-password?token=abc&amp;next=1",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("html missing %q", want)
		}
	}
	if strings.Contains(html, "<admin>") {
		t.Fatal("name was not escaped")
	}
	if !strings.Contains(html, "<!--[if mso]>") {
		t.Fatal("outlook width guard was stripped")
	}
}

func TestInvitationRejectsScriptURL(t *testing.T) {
	html := renderEmail(pgmTheme, content{
		Heading: "Undangan",
		URL:     "javascript:alert(1)",
		Action:  "Atur password",
	})
	if !strings.Contains(html, "#ZgotmplZ") {
		t.Fatal("javascript URL was not neutralized")
	}
}
