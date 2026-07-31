package httpx

import (
	"net/http"
	"os"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/analytics"
	authmodule "github.com/dakwah-depok/aisi/apps/api-go/internal/modules/auth"
	configmodule "github.com/dakwah-depok/aisi/apps/api-go/internal/modules/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/evaluations"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/events"
	groupsmodule "github.com/dakwah-depok/aisi/apps/api-go/internal/modules/groups"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/ic"
	invitationsmodule "github.com/dakwah-depok/aisi/apps/api-go/internal/modules/invitations"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/kks"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/materi"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/mutabaah"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/notifications"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/points"
	schoolsmodule "github.com/dakwah-depok/aisi/apps/api-go/internal/modules/schools"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/modules/users"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/storage"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Router(db *pgxpool.Pool, c config.Config) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID, chimiddleware.RealIP, chimiddleware.Timeout(30*time.Second))
	if c.SentryDSN != "" {
		sentryHandler := sentryhttp.New(sentryhttp.Options{Repanic: true})
		r.Use(sentryHandler.Handle)
	}
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.Security, middleware.CORS(c.AllowedOrigin))
	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		if err := db.Ping(req.Context()); err != nil {
			Error(w, 503, "Database tidak tersedia")
			return
		}
		Success(w, 200, map[string]string{"status": "ok"}, "")
	})
	if _, err := os.Stat("uploads"); err == nil {
		r.Handle("/uploads/*", http.StripPrefix("/uploads/", storage.UploadFileServer("uploads")))
	}
	r.Route("/api/v1", func(api chi.Router) {
		// 300/menit: cukup untuk smoke/manual/e2e lokal tanpa 429 palsu di nav loop
		api.Use(middleware.NewRateLimit(300, time.Minute).Middleware)
		api.Mount("/auth", authmodule.Handler{DB: db, Config: c}.Routes())
		api.Mount("/config", configmodule.Routes(db, c))
		api.Mount("/users", users.Routes(db, c))
		api.Mount("/kks", kks.Routes(db, c))
		api.Mount("/notifications", notifications.Routes(db, c))
		api.Mount("/points", points.Routes(db, c))
		api.Mount("/invitations", invitationsmodule.Handler{DB: db, Config: c}.Routes())
		api.Mount("/schools", schoolsmodule.Handler{DB: db, Config: c}.Routes())
		api.Mount("/groups", groupsmodule.Handler{DB: db, Config: c}.Routes())
		api.Mount("/evaluations", evaluations.Routes(db, c))
		api.Mount("/events", events.Routes(db, c))
		api.Mount("/materi", materi.Routes(db, c))
		api.Mount("/analytics", analytics.Routes(db, c))
		api.Mount("/mutabaah", mutabaah.Routes(db, c))
		api.Mount("/ic", ic.Routes(db, c))
	})
	r.NotFound(func(w http.ResponseWriter, req *http.Request) { Error(w, 404, "Endpoint tidak ditemukan") })
	return r
}
