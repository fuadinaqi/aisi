package materi

import (
	"encoding/json"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type input struct {
	Title        string
	Description  *string
	WeekDate     string
	ContentType  string
	LinkURL      *string
	ContentHTML  *string
	TargetLevels []string
	IsPublished  bool
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Get("/{id}", detail(db))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN")).Post("/", save(db, c, false))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN")).Put("/{id}", save(db, c, true))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN")).Delete("/{id}", remove(db))
	return r
}
func parse(r *http.Request, existing []string) (input, []*multipart.FileHeader, error) {
	if e := r.ParseMultipartForm(52 << 20); e != nil {
		return input{}, nil, e
	}
	in := input{Title: r.FormValue("title"), WeekDate: r.FormValue("weekDate"), ContentType: r.FormValue("contentType"), IsPublished: r.FormValue("isPublished") != "false"}
	if x := r.FormValue("description"); x != "" {
		in.Description = &x
	}
	if x := r.FormValue("linkUrl"); x != "" {
		in.LinkURL = &x
	}
	if x := r.FormValue("contentHtml"); x != "" {
		in.ContentHTML = &x
	}
	raw := r.FormValue("targetLevels")
	if raw != "" && raw != "all" {
		_ = json.Unmarshal([]byte(raw), &in.TargetLevels)
		if len(in.TargetLevels) == 0 && (raw == "LEVEL_1" || raw == "LEVEL_2") {
			in.TargetLevels = []string{raw}
		}
	}
	keep := existing
	if x := r.FormValue("keepFileUrls"); x != "" {
		_ = json.Unmarshal([]byte(x), &keep)
	}
	_ = keep
	return in, r.MultipartForm.File["files"], nil
}
func monday(s string) (time.Time, error) {
	t, e := time.ParseInLocation("2006-01-02", s[:min(len(s), 10)], time.FixedZone("WIB", 7*3600))
	if e != nil {
		return t, e
	}
	return t.AddDate(0, 0, -(int(t.Weekday())+6)%7), nil
}
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func save(db *pgxpool.Pool, cfg config.Config, update bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		existing := []string{}
		if update {
			e := db.QueryRow(r.Context(), `SELECT "fileUrls" FROM "WeeklyMateri" WHERE "id"=$1`, id).Scan(&existing)
			if e == pgx.ErrNoRows {
				httpx.Error(w, 404, "Materi tidak ditemukan")
				return
			}
			if e != nil {
				httpx.Error(w, 500, "Gagal memuat materi")
				return
			}
		}
		in, files, e := parse(r, existing)
		if e != nil || len(in.Title) < 2 {
			httpx.Error(w, 400, "Data materi tidak valid")
			return
		}
		wd, e := monday(in.WeekDate)
		if e != nil || (in.ContentType != "FILE" && in.ContentType != "LINK" && in.ContentType != "RICH_TEXT") {
			httpx.Error(w, 400, "Data materi tidak valid")
			return
		}
		s, e := storage.New(cfg)
		if e != nil {
			httpx.Error(w, 500, "Storage tidak tersedia")
			return
		}
		urls := existing
		for _, f := range files {
			if f.Size > 10<<20 {
				httpx.Error(w, 400, "Ukuran file maksimal 10MB")
				return
			}
			h, e := f.Open()
			if e != nil {
				httpx.Error(w, 400, "File tidak valid")
				return
			}
			u, e := s.Put(r.Context(), f.Filename, h)
			h.Close()
			if e != nil {
				httpx.Error(w, 500, "Gagal upload file")
				return
			}
			urls = append(urls, u)
		}
		if in.ContentType == "FILE" && len(urls) == 0 {
			httpx.Error(w, 400, "File wajib diunggah")
			return
		}
		if in.ContentType == "LINK" && in.LinkURL == nil {
			httpx.Error(w, 400, "Link wajib diisi")
			return
		}
		if in.ContentType == "RICH_TEXT" && in.ContentHTML == nil {
			httpx.Error(w, 400, "Konten wajib diisi")
			return
		}
		if !update {
			c, _ := middleware.Claims(r)
			id = uuid.NewString()
			_, e = db.Exec(r.Context(), `INSERT INTO "WeeklyMateri" ("id","title","description","weekDate","contentType","linkUrl","contentHtml","fileUrls","targetLevels","isPublished","createdById","updatedAt") VALUES($1,$2,$3,$4,$5::"MateriContentType",$6,$7,$8,$9::"GroupLevel"[],$10,$11,NOW())`, id, in.Title, in.Description, wd, in.ContentType, in.LinkURL, in.ContentHTML, urls, in.TargetLevels, in.IsPublished, c.UserID)
		} else {
			_, e = db.Exec(r.Context(), `UPDATE "WeeklyMateri" SET "title"=$1,"description"=$2,"weekDate"=$3,"contentType"=$4::"MateriContentType","linkUrl"=$5,"contentHtml"=$6,"fileUrls"=$7,"targetLevels"=$8::"GroupLevel"[],"isPublished"=$9,"updatedAt"=NOW() WHERE "id"=$10`, in.Title, in.Description, wd, in.ContentType, in.LinkURL, in.ContentHTML, urls, in.TargetLevels, in.IsPublished, id)
		}
		if e != nil {
			httpx.Error(w, 500, "Gagal menyimpan materi")
			return
		}
		byID(w, r, db, id, map[bool]int{true: 200, false: 201}[update], map[bool]string{true: "Materi berhasil diperbarui", false: "Materi berhasil dibuat"}[update])
	}
}
func where(r *http.Request) (string, []any) {
	c, _ := middleware.Claims(r)
	if role(c.Roles, "ADMIN") || role(c.Roles, "SUPERADMIN") {
		return `1=1`, nil
	}
	return `"isPublished"=true`, nil
}
func role(rs []string, v string) bool {
	for _, x := range rs {
		if x == v {
			return true
		}
	}
	return false
}
func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, l := page(r.URL.Query().Get("page"), r.URL.Query().Get("limit"))
		wh, args := where(r)
		if d := r.URL.Query().Get("weekDate"); d != "" {
			x, e := monday(d)
			if e != nil {
				httpx.Error(w, 400, "weekDate tidak valid")
				return
			}
			args = append(args, x)
			wh += ` AND "weekDate"=$` + strconv.Itoa(len(args))
		}
		var n int
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyMateri" WHERE `+wh, args...).Scan(&n)
		args = append(args, (p-1)*l, l)
		rows, e := db.Query(r.Context(), `SELECT "id","title","description","weekDate","contentType"::text,"linkUrl","fileUrls","targetLevels","createdAt" FROM "WeeklyMateri" WHERE `+wh+` ORDER BY "weekDate" DESC OFFSET $`+strconv.Itoa(len(args)-1)+` LIMIT $`+strconv.Itoa(len(args)), args...)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat materi")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, t, ct string
			var d, lurl *string
			var wd, created time.Time
			var fs, ls []string
			_ = rows.Scan(&id, &t, &d, &wd, &ct, &lurl, &fs, &ls, &created)
			out = append(out, map[string]any{"id": id, "title": t, "description": d, "weekDate": wd, "contentType": ct, "linkUrl": lurl, "fileUrls": fs, "targetLevels": ls, "createdAt": created})
		}
		httpx.Paginated(w, out, p, l, n)
	}
}
func detail(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { byID(w, r, db, chi.URLParam(r, "id"), 200, "") }
}
func byID(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, id string, status int, msg string) {
	wh, args := where(r)
	args = append(args, id)
	var raw json.RawMessage
	e := db.QueryRow(r.Context(), `SELECT row_to_json(m) FROM "WeeklyMateri" m WHERE m."id"=$`+strconv.Itoa(len(args))+` AND `+wh, args...).Scan(&raw)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Materi tidak ditemukan")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal memuat materi")
		return
	}
	httpx.Success(w, status, raw, msg)
}
func remove(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		tag, e := db.Exec(r.Context(), `DELETE FROM "WeeklyMateri" WHERE "id"=$1`, id)
		if e != nil {
			httpx.Error(w, 500, "Gagal menghapus materi")
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Materi tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "Materi berhasil dihapus")
	}
}
func page(p, l string) (int, int) {
	a, b := 1, 20
	if n, e := strconv.Atoi(p); e == nil && n > 0 {
		a = n
	}
	if n, e := strconv.Atoi(l); e == nil && n > 0 && n <= 100 {
		b = n
	}
	return a, b
}

var _ = strings.TrimSpace
