package observability

import (
	"log"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/getsentry/sentry-go"
)

// InitSentry initializes Sentry when SENTRY_DSN is set. Returns whether Sentry is active.
func InitSentry(c config.Config) bool {
	if c.SentryDSN == "" {
		return false
	}
	err := sentry.Init(sentry.ClientOptions{
		Dsn:              c.SentryDSN,
		Environment:      c.Environment,
		TracesSampleRate: map[bool]float64{true: 0.1, false: 1.0}[c.Production()],
		SendDefaultPII:   false,
	})
	if err != nil {
		log.Printf("sentry: gagal init: %v", err)
		return false
	}
	log.Printf("sentry: aktif (env=%s)", c.Environment)
	return true
}

// FlushSentry waits for buffered events before process exit.
func FlushSentry() {
	sentry.Flush(2 * time.Second)
}
