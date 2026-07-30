package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL           string
	Port                  string
	JWTSecret             string
	JWTRefreshSecret      string
	JWTAccessExpires      time.Duration
	JWTRefreshExpires     time.Duration
	AllowedOrigin         string
	AppURL                string
	InvitationExpireDays  int
	EmailFrom             string
	ResendAPIKey          string
	Environment           string
	R2AccountID           string
	R2AccessKeyID         string
	R2SecretAccessKey     string
	R2Bucket              string
	R2PublicURL           string
}

func Load() (Config, error) {
	// Best-effort load .env from cwd / apps/api-go
	_ = godotenv.Load()
	_ = godotenv.Load(".env")
	_ = godotenv.Load("apps/api-go/.env")

	bucket := os.Getenv("R2_BUCKET_NAME")
	if bucket == "" {
		bucket = os.Getenv("R2_BUCKET")
	}

	const (
		devJWTSecret    = "dev_jwt_secret_min_32_characters_long"
		devRefreshSecret = "dev_refresh_secret_min_32_chars"
	)

	c := Config{
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		Port:                 value("PORT", "4000"),
		JWTSecret:            value("JWT_SECRET", devJWTSecret),
		JWTRefreshSecret:     value("JWT_REFRESH_SECRET", devRefreshSecret),
		AllowedOrigin:        value("ALLOWED_ORIGIN", "http://localhost:5173"),
		AppURL:               value("APP_URL", "http://localhost:5173"),
		InvitationExpireDays: intValue("INVITATION_EXPIRE_DAYS", 7),
		EmailFrom:            value("EMAIL_FROM", "AISI <noreply@localhost>"),
		ResendAPIKey:         os.Getenv("RESEND_API_KEY"),
		Environment:          value("APP_ENV", value("ENV", value("NODE_ENV", "development"))),
		R2AccountID:          os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:        os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:    os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:             bucket,
		R2PublicURL:          strings.TrimRight(os.Getenv("R2_PUBLIC_URL"), "/"),
	}
	var err error
	if c.JWTAccessExpires, err = parseDuration(value("JWT_ACCESS_EXPIRES", "15m")); err != nil { return c, fmt.Errorf("JWT_ACCESS_EXPIRES: %w", err) }
	if c.JWTRefreshExpires, err = parseDuration(value("JWT_REFRESH_EXPIRES", "7d")); err != nil { return c, fmt.Errorf("JWT_REFRESH_EXPIRES: %w", err) }

	if c.Production() {
		if err := validateProdSecret("JWT_SECRET", c.JWTSecret, devJWTSecret); err != nil {
			return c, err
		}
		if err := validateProdSecret("JWT_REFRESH_SECRET", c.JWTRefreshSecret, devRefreshSecret); err != nil {
			return c, err
		}
		if c.AllowedOrigin == "*" {
			return c, fmt.Errorf("ALLOWED_ORIGIN tidak boleh '*' di production")
		}
	}
	return c, nil
}

func validateProdSecret(name, secret, devFallback string) error {
	if secret == "" || secret == devFallback || len(secret) < 32 {
		return fmt.Errorf("%s wajib di-set di production (min 32 karakter, bukan nilai default development)", name)
	}
	return nil
}

func (c Config) Production() bool { return c.Environment == "production" }
func value(k, fallback string) string { if v := os.Getenv(k); v != "" { return v }; return fallback }
func intValue(k string, fallback int) int { if v, e := strconv.Atoi(os.Getenv(k)); e == nil && v > 0 { return v }; return fallback }
func parseDuration(v string) (time.Duration, error) {
	if strings.HasSuffix(v, "d") { n, e := strconv.Atoi(strings.TrimSuffix(v, "d")); return time.Duration(n) * 24 * time.Hour, e }
	return time.ParseDuration(v)
}
