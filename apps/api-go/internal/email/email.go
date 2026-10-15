package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
)

type Sender struct {
	from, apiKey string
}

func New(c config.Config) Sender { return Sender{from: c.EmailFrom, apiKey: c.ResendAPIKey} }

func (s Sender) SendInvitation(ctx context.Context, to, name, url string) error {
	return s.SendInvitationWithKind(ctx, to, name, url, false)
}

var aisiTheme = theme{
	Product: "Bina AISI",
	Mark:    "A",
	Page:    "#F3F7F5",
	Accent:  "#1D865F",
	Soft:    "#E7F5EF",
	Border:  "#E3EBE7",
	Ink:     "#142033",
	Text:    "#334155",
	Muted:   "#64748B",
}

func (s Sender) SendInvitationWithKind(ctx context.Context, to, name, url string, existingUser bool) error {
	subject := "Undangan bergabung di Bina AISI"
	mail := content{
		Preheader: "Atur password untuk mengaktifkan akun Bina AISI Anda.",
		Eyebrow:   "Undangan akun",
		Heading:   "Anda diundang bergabung",
		Greeting:  greeting(name),
		Body:      "Ada tempat untuk Anda di Bina AISI. Atur password terlebih dahulu agar akun bisa dipakai untuk terhubung, belajar, dan mengikuti kegiatan.",
		Action:    "Atur password",
		URL:       url,
		Note:      "Tautan ini hanya untuk Anda dan berlaku terbatas. Jika sudah tidak bisa dibuka, minta pengirim untuk mengirim ulang undangan.",
		Footer:    "Bina AISI Kota Depok. Abaikan email ini jika Anda tidak mengharapkan undangan.",
	}
	if existingUser {
		subject = "Undangan peran tambahan di Bina AISI"
		mail.Preheader = "Ada undangan peran tambahan pada akun Bina AISI Anda."
		mail.Eyebrow = "Peran tambahan"
		mail.Heading = "Undangan untuk akun yang sudah ada"
		mail.Body = "Anda diundang menambahkan peran pada akun Bina AISI yang sudah terdaftar. Buka tautan ini, masuk dengan akun yang sama, lalu terima undangannya."
		mail.Action = "Terima undangan"
		mail.Note = "Gunakan email yang menerima pesan ini saat masuk. Abaikan email ini jika Anda tidak mengharapkan undangan."
	}
	return s.send(ctx, to, subject, renderEmail(aisiTheme, mail), plainText(mail), fmt.Sprintf("[email console] to=%s name=%s existing=%v invitation=%s\n", to, name, existingUser, url))
}

func (s Sender) SendPasswordReset(ctx context.Context, to, name, url string) error {
	subject := "Reset password Bina AISI"
	mail := content{
		Preheader: "Tautan untuk membuat password baru akun Bina AISI. Berlaku 1 jam.",
		Eyebrow:   "Keamanan akun",
		Heading:   "Reset password",
		Greeting:  greeting(name),
		Body:      "Kami menerima permintaan untuk mereset password akun Bina AISI Anda. Buat password baru lewat tombol di bawah.",
		Action:    "Reset password",
		URL:       url,
		Note:      "Tautan ini berlaku selama 1 jam. Jika Anda tidak meminta reset, abaikan email ini. Password tidak berubah sampai tautan ini dipakai.",
		Footer:    "Bina AISI Kota Depok.",
	}
	return s.send(ctx, to, subject, renderEmail(aisiTheme, mail), plainText(mail), fmt.Sprintf("[email console] to=%s name=%s password-reset=%s\n", to, name, url))
}

func greeting(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Assalamu'alaikum,"
	}
	return "Assalamu'alaikum " + name + ","
}

func (s Sender) send(ctx context.Context, to, subject, bodyHTML, bodyText, consoleLog string) error {
	if s.apiKey == "" {
		fmt.Print(consoleLog)
		return nil
	}
	body, _ := json.Marshal(map[string]string{
		"from":    s.from,
		"to":      to,
		"subject": subject,
		"html":    bodyHTML,
		"text":    bodyText,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("Resend mengembalikan %s", res.Status)
	}
	return nil
}
