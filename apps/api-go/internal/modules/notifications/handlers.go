package notifications

import (
	"net/http"
	"strconv"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	RefID     *string   `json:"refId"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Put("/{id}/read", markRead(db))
	r.Put("/read-all", markAllRead(db))
	return r
}

func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		page, limit := pagination(r)
		offset := (page - 1) * limit
		rows, err := db.Query(r.Context(), `SELECT "id","userId","type"::text,"title","body","refId","isRead","createdAt" FROM "Notification" WHERE "userId"=$1 ORDER BY "createdAt" DESC OFFSET $2 LIMIT $3`, claims.UserID, offset, limit)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat notifikasi")
			return
		}
		defer rows.Close()
		items := []notification{}
		for rows.Next() {
			var item notification
			if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.Title, &item.Body, &item.RefID, &item.IsRead, &item.CreatedAt); err != nil {
				httpx.Error(w, 500, "Gagal memuat notifikasi")
				return
			}
			items = append(items, item)
		}
		if rows.Err() != nil {
			httpx.Error(w, 500, "Gagal memuat notifikasi")
			return
		}
		var total, unread int
		if err := db.QueryRow(r.Context(), `SELECT count(*), count(*) FILTER (WHERE NOT "isRead") FROM "Notification" WHERE "userId"=$1`, claims.UserID).Scan(&total, &unread); err != nil {
			httpx.Error(w, 500, "Gagal memuat notifikasi")
			return
		}
		httpx.Paginated(w, map[string]any{"items": items, "unreadCount": unread}, page, limit, total)
	}
}

func markRead(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		tag, err := db.Exec(r.Context(), `UPDATE "Notification" SET "isRead"=true WHERE "id"=$1 AND "userId"=$2`, chi.URLParam(r, "id"), claims.UserID)
		if err != nil {
			httpx.Error(w, 500, "Gagal memperbarui notifikasi")
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Notifikasi tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "Notifikasi ditandai sudah dibaca")
	}
}

func markAllRead(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		if _, err := db.Exec(r.Context(), `UPDATE "Notification" SET "isRead"=true WHERE "userId"=$1 AND NOT "isRead"`, claims.UserID); err != nil {
			httpx.Error(w, 500, "Gagal memperbarui notifikasi")
			return
		}
		httpx.Success(w, 200, nil, "Semua notifikasi ditandai sudah dibaca")
	}
}

func pagination(r *http.Request) (int, int) {
	page, limit := 1, 20
	if n, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && n > 0 {
		page = n
	}
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}
	return page, limit
}
