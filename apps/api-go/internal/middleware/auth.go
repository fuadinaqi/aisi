package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/auth"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
)

type contextKey string
const claimsKey contextKey = "claims"

func RequireAuth(c config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			if raw == "" || raw == r.Header.Get("Authorization") { httpx.Error(w, http.StatusUnauthorized, "Token autentikasi tidak ditemukan"); return }
			claims, err := auth.ParseAccess(c, raw)
			if err != nil { httpx.Error(w, http.StatusUnauthorized, "Token autentikasi tidak valid"); return }
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
		})
	}
}
func Claims(r *http.Request) (*auth.Claims, bool) { c, ok := r.Context().Value(claimsKey).(*auth.Claims); return c, ok }
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, ok := Claims(r); if !ok { httpx.Error(w, 401, "Autentikasi diperlukan"); return }
		for _, wanted := range roles { for _, actual := range c.Roles { if actual == wanted { next.ServeHTTP(w, r); return } } }
		httpx.Error(w, 403, "Akses ditolak")
	})}
}
