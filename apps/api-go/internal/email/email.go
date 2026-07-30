package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
)
type Sender struct { from, apiKey string }
func New(c config.Config) Sender { return Sender{from: c.EmailFrom, apiKey: c.ResendAPIKey} }
func (s Sender) SendInvitation(ctx context.Context, to, name, url string) error {
	if s.apiKey == "" { fmt.Printf("[email console] to=%s name=%s invitation=%s\n", to, name, url); return nil }
	body, _ := json.Marshal(map[string]string{"from": s.from, "to": to, "subject": "Undangan AISI", "html": "<p>Assalamu'alaikum "+name+",</p><p><a href=\""+url+"\">Atur password akun</a></p>"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body)); if err != nil { return err }
	req.Header.Set("Authorization", "Bearer "+s.apiKey); req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req); if err != nil { return err }; defer res.Body.Close()
	if res.StatusCode >= 300 { return fmt.Errorf("Resend mengembalikan %s", res.Status) }; return nil
}
