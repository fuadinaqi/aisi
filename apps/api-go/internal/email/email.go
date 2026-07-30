package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net/http"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
)

type Sender struct {
	from, apiKey string
}

func New(c config.Config) Sender { return Sender{from: c.EmailFrom, apiKey: c.ResendAPIKey} }

func (s Sender) SendInvitation(ctx context.Context, to, name, url string) error {
	return s.SendInvitationWithKind(ctx, to, name, url, false)
}

func (s Sender) SendInvitationWithKind(ctx context.Context, to, name, url string, existingUser bool) error {
	safeName := html.EscapeString(name)
	safeURL := html.EscapeString(url)
	subject := "Undangan AISI"
	bodyHTML := "<p>Assalamu'alaikum " + safeName + ",</p><p><a href=\"" + safeURL + "\">Atur password akun</a></p>"
	if existingUser {
		subject = "Undangan peran tambahan AISI"
		bodyHTML = "<p>Assalamu'alaikum " + safeName + ",</p><p>Anda diundang untuk menambahkan peran pada akun AISI yang sudah ada.</p><p><a href=\"" + safeURL + "\">Terima undangan peran</a></p>"
	}
	return s.send(ctx, to, subject, bodyHTML, fmt.Sprintf("[email console] to=%s name=%s existing=%v invitation=%s\n", to, name, existingUser, url))
}

func (s Sender) SendPasswordReset(ctx context.Context, to, name, url string) error {
	safeName := html.EscapeString(name)
	safeURL := html.EscapeString(url)
	subject := "Reset password AISI"
	bodyHTML := "<p>Assalamu'alaikum " + safeName + ",</p>" +
		"<p>Kami menerima permintaan untuk mereset password akun AISI Anda.</p>" +
		"<p><a href=\"" + safeURL + "\">Reset password</a></p>" +
		"<p>Tautan ini berlaku selama 1 jam. Jika Anda tidak meminta reset, abaikan email ini.</p>"
	return s.send(ctx, to, subject, bodyHTML, fmt.Sprintf("[email console] to=%s name=%s password-reset=%s\n", to, name, url))
}

func (s Sender) send(ctx context.Context, to, subject, bodyHTML, consoleLog string) error {
	if s.apiKey == "" {
		fmt.Print(consoleLog)
		return nil
	}
	body, _ := json.Marshal(map[string]string{
		"from":    s.from,
		"to":      to,
		"subject": subject,
		"html":    bodyHTML,
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
