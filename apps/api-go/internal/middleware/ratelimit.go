package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
)
type visitor struct { n int; reset time.Time }
type Limiter struct { mu sync.Mutex; max int; window time.Duration; visitors map[string]visitor }
func NewRateLimit(max int, window time.Duration) *Limiter { return &Limiter{max: max, window: window, visitors: map[string]visitor{}} }
func (l *Limiter) Middleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr); if ip == "" { ip = r.RemoteAddr }
	now := time.Now(); l.mu.Lock(); v := l.visitors[ip]; if v.reset.Before(now) { v = visitor{reset: now.Add(l.window)} }; v.n++; l.visitors[ip] = v; allowed := v.n <= l.max; l.mu.Unlock()
	if !allowed { httpx.Error(w, http.StatusTooManyRequests, "Terlalu banyak permintaan, coba lagi nanti"); return }
	next.ServeHTTP(w, r)
})}
