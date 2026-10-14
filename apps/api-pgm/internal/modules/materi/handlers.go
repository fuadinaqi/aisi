package materi

import (
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/domain/constants"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/middleware"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/notify"
	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/microcosm-cc/bluemonday"
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
	SchoolSet    bool
	SchoolID     string
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Get("/{id}", detail(db))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN", "PJ_SEKOLAH")).Post("/", save(db, c, false))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN", "PJ_SEKOLAH")).Put("/{id}", save(db, c, true))
	r.With(middleware.RequireRole("ADMIN", "SUPERADMIN", "PJ_SEKOLAH")).Delete("/{id}", remove(db, c))
	return r
}
func parse(r *http.Request, existing []string) (input, []*multipart.FileHeader, []string, error) {
	if e := r.ParseMultipartForm(52 << 20); e != nil {
		return input{}, nil, nil, e
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
	if _, ok := r.MultipartForm.Value["schoolId"]; ok {
		in.SchoolSet = true
		in.SchoolID = strings.TrimSpace(r.FormValue("schoolId"))
	}
	raw := r.FormValue("targetLevels")
	if raw != "" && raw != "all" {
		_ = json.Unmarshal([]byte(raw), &in.TargetLevels)
		if len(in.TargetLevels) == 0 && constants.ValidGroupLevel(raw) {
			in.TargetLevels = []string{raw}
		}
	}
	keep := append([]string{}, existing...)
	if x := r.FormValue("keepFileUrls"); x != "" {
		var parsed []string
		if err := json.Unmarshal([]byte(x), &parsed); err != nil {
			return input{}, nil, nil, err
		}
		keep = parsed
	}
	return in, r.MultipartForm.File["files"], keep, nil
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

var htmlPolicy = bluemonday.UGCPolicy()

func sanitizeHTML(s string) string {
	return htmlPolicy.Sanitize(s)
}

func save(db *pgxpool.Pool, cfg config.Config, update bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		existing := []string{}
		existingNames := []string{}
		var existingSchool *string
		var wasPublished bool
		if update {
			e := db.QueryRow(r.Context(), `SELECT "fileUrls", "fileNames", "schoolId", "isPublished" FROM "WeeklyMateri" WHERE "id"=$1`, id).Scan(&existing, &existingNames, &existingSchool, &wasPublished)
			if e == pgx.ErrNoRows {
				httpx.Error(w, 404, "Materi tidak ditemukan")
				return
			}
			if e != nil {
				httpx.Error(w, 500, "Gagal memuat materi")
				return
			}
		}
		in, files, keep, e := parse(r, existing)
		if e != nil || len(in.Title) < 2 {
			httpx.Error(w, 400, "Data materi tidak valid")
			return
		}
		if in.ContentHTML != nil {
			cleaned := sanitizeHTML(*in.ContentHTML)
			in.ContentHTML = &cleaned
		}
		wd, e := monday(in.WeekDate)
		if e != nil || (in.ContentType != "FILE" && in.ContentType != "LINK" && in.ContentType != "RICH_TEXT") {
			httpx.Error(w, 400, "Data materi tidak valid")
			return
		}
		urls := keep
		names := namesForKept(existing, existingNames, keep)
		if !update {
			urls = []string{}
			names = []string{}
		}
		// Validate business rules before any storage mutation.
		if in.ContentType == "FILE" && len(urls)+len(files) == 0 {
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
		claims, okClaim := middleware.Claims(r)
		if !okClaim {
			httpx.Error(w, 401, "Autentikasi diperlukan")
			return
		}
		schoolID, status, msg, ok := resolveSchool(r.Context(), db, claims.UserID, claims.Roles, in, existingSchool, update)
		if !ok {
			httpx.Error(w, status, msg)
			return
		}
		s, e := storage.New(cfg)
		if e != nil {
			httpx.Error(w, 500, "Storage tidak tersedia")
			return
		}
		uploaded := []string{}
		rollbackUploads := func() {
			for _, ou := range uploaded {
				s.DeleteBestEffort(r.Context(), ou)
			}
		}
		for _, f := range files {
			if f.Size > 10<<20 {
				rollbackUploads()
				httpx.Error(w, 400, "Ukuran file maksimal 10MB")
				return
			}
			h, e := f.Open()
			if e != nil {
				rollbackUploads()
				httpx.Error(w, 400, "File tidak valid")
				return
			}
			validated, detectedType, ve := storage.ValidateMateriFile(h, f.Filename, f.Size)
			if ve != nil {
				h.Close()
				rollbackUploads()
				httpx.Error(w, 400, ve.Error())
				return
			}
			body := validated
			ct := detectedType
			name := storage.DisplayFilename(f.Filename)
			if storage.IsImageType(detectedType) {
				optimized, oct, oe := storage.OptimizeImage(validated)
				if oe != nil {
					h.Close()
					rollbackUploads()
					httpx.Error(w, 400, oe.Error())
					return
				}
				body, ct = optimized, oct
				name = storage.ReplaceExt(name, ".jpg")
			}
			u, e := s.Put(r.Context(), storage.PrefixMateri, name, body, ct)
			h.Close()
			if e != nil {
				rollbackUploads()
				httpx.Error(w, 500, "Gagal upload file")
				return
			}
			uploaded = append(uploaded, u)
			urls = append(urls, u)
			names = append(names, name)
		}
		if !update {
			id = uuid.NewString()
			_, e = db.Exec(r.Context(), `INSERT INTO "WeeklyMateri" ("id","title","description","weekDate","contentType","linkUrl","contentHtml","fileUrls","fileNames","targetLevels","schoolId","isPublished","createdById","updatedAt") VALUES($1,$2,$3,$4,$5::"MateriContentType",$6,$7,$8,$9,$10::"GroupLevel"[],$11,$12,$13,NOW())`, id, in.Title, in.Description, wd, in.ContentType, in.LinkURL, in.ContentHTML, urls, names, in.TargetLevels, schoolID, in.IsPublished, claims.UserID)
		} else {
			_, e = db.Exec(r.Context(), `UPDATE "WeeklyMateri" SET "title"=$1,"description"=$2,"weekDate"=$3,"contentType"=$4::"MateriContentType","linkUrl"=$5,"contentHtml"=$6,"fileUrls"=$7,"fileNames"=$8,"targetLevels"=$9::"GroupLevel"[],"schoolId"=$10,"isPublished"=$11,"updatedAt"=NOW() WHERE "id"=$12`, in.Title, in.Description, wd, in.ContentType, in.LinkURL, in.ContentHTML, urls, names, in.TargetLevels, schoolID, in.IsPublished, id)
		}
		if e != nil {
			rollbackUploads()
			httpx.Error(w, 500, "Gagal menyimpan materi")
			return
		}
		if update {
			keepSet := map[string]struct{}{}
			for _, u := range keep {
				keepSet[u] = struct{}{}
			}
			for _, u := range existing {
				if _, ok := keepSet[u]; !ok {
					s.DeleteBestEffort(r.Context(), u)
				}
			}
		}
		if in.IsPublished && (!update || !wasPublished) {
			notify.MateriPublished(r.Context(), db, id, in.Title, schoolID)
		}
		byID(w, r, db, id, map[bool]int{true: 200, false: 201}[update], map[bool]string{true: "Materi berhasil diperbarui", false: "Materi berhasil dibuat"}[update])
	}
}
func where(r *http.Request) (string, []any) {
	c, _ := middleware.Claims(r)
	if role(c.Roles, "ADMIN") || role(c.Roles, "SUPERADMIN") {
		return `1=1`, nil
	}
	return `(
		(m."schoolId" IS NULL AND m."isPublished"=true AND (
			EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId"=$1 AND ur."role"='PJ_SEKOLAH'::"Role")
			OR EXISTS (
				SELECT 1 FROM "User" u
				WHERE u."id"=$1 AND u."isActive"=true AND (
					EXISTS (SELECT 1 FROM "Group" g WHERE g."pembinaId"=u."id" AND g."isActive"=true)
					OR (
						EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId"=u."id" AND ur."role"='PEMBINA'::"Role")
						AND EXISTS (SELECT 1 FROM "UserSchool" us WHERE us."userId"=u."id")
					)
				)
			)
		))
		OR (
			m."schoolId" IS NOT NULL AND (
				(
					EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId"=$1 AND ur."role"='PJ_SEKOLAH'::"Role")
					AND EXISTS (SELECT 1 FROM "UserSchool" us WHERE us."userId"=$1 AND us."schoolId"=m."schoolId")
				)
				OR (
					m."isPublished"=true AND EXISTS (
						SELECT 1 FROM "User" u
						WHERE u."id"=$1 AND u."isActive"=true AND (
							EXISTS (SELECT 1 FROM "Group" g WHERE g."pembinaId"=u."id" AND g."isActive"=true AND g."schoolId"=m."schoolId")
							OR (
								EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId"=u."id" AND ur."role"='PEMBINA'::"Role")
								AND EXISTS (SELECT 1 FROM "UserSchool" us WHERE us."userId"=u."id" AND us."schoolId"=m."schoolId")
							)
						)
					)
				)
			)
		)
	)`, []any{c.UserID}
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
			wh += ` AND m."weekDate"=$` + strconv.Itoa(len(args))
		}
		var n int
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyMateri" m WHERE `+wh, args...).Scan(&n)
		args = append(args, (p-1)*l, l)
		rows, e := db.Query(r.Context(), `SELECT m."id",m."title",m."description",m."weekDate",m."contentType"::text,m."linkUrl",m."fileUrls",m."targetLevels",m."schoolId",m."isPublished",sch."name",m."createdAt" FROM "WeeklyMateri" m LEFT JOIN "School" sch ON sch."id"=m."schoolId" WHERE `+wh+` ORDER BY m."weekDate" DESC OFFSET $`+strconv.Itoa(len(args)-1)+` LIMIT $`+strconv.Itoa(len(args)), args...)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat materi")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, t, ct string
			var d, lurl, schoolID, schoolName *string
			var wd, created time.Time
			var fs, ls []string
			var published bool
			_ = rows.Scan(&id, &t, &d, &wd, &ct, &lurl, &fs, &ls, &schoolID, &published, &schoolName, &created)
			out = append(out, map[string]any{"id": id, "title": t, "description": d, "weekDate": wd, "contentType": ct, "linkUrl": lurl, "fileUrls": fs, "targetLevels": ls, "schoolId": schoolID, "schoolName": schoolName, "isPublished": published, "createdAt": created})
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
	e := db.QueryRow(r.Context(), `SELECT row_to_json(t) FROM (SELECT m.*, sch."name" AS "schoolName" FROM "WeeklyMateri" m LEFT JOIN "School" sch ON sch."id"=m."schoolId" WHERE m."id"=$`+strconv.Itoa(len(args))+` AND `+wh+`) t`, args...).Scan(&raw)
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
func remove(db *pgxpool.Pool, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var fileURLs []string
		var schoolID *string
		e := db.QueryRow(r.Context(), `SELECT "fileUrls", "schoolId" FROM "WeeklyMateri" WHERE "id"=$1`, id).Scan(&fileURLs, &schoolID)
		if e == pgx.ErrNoRows {
			httpx.Error(w, 404, "Materi tidak ditemukan")
			return
		}
		if e != nil {
			httpx.Error(w, 500, "Gagal menghapus materi")
			return
		}
		claims, okClaim := middleware.Claims(r)
		if !okClaim {
			httpx.Error(w, 401, "Autentikasi diperlukan")
			return
		}
		if !role(claims.Roles, "ADMIN") && !role(claims.Roles, "SUPERADMIN") && !managesSchool(r.Context(), db, claims.UserID, schoolID) {
			httpx.Error(w, 404, "Materi tidak ditemukan")
			return
		}
		tag, e := db.Exec(r.Context(), `DELETE FROM "WeeklyMateri" WHERE "id"=$1`, id)
		if e != nil {
			httpx.Error(w, 500, "Gagal menghapus materi")
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Materi tidak ditemukan")
			return
		}
		if s, se := storage.New(cfg); se == nil {
			for _, u := range fileURLs {
				s.DeleteBestEffort(r.Context(), u)
			}
		}
		httpx.Success(w, 200, nil, "Materi berhasil dihapus")
	}
}
func resolveSchool(ctx context.Context, db *pgxpool.Pool, userID string, roles []string, in input, existing *string, update bool) (*string, int, string, bool) {
	admin := role(roles, "ADMIN") || role(roles, "SUPERADMIN")
	var desired *string
	set := false
	if in.SchoolSet {
		set = true
		if v := strings.TrimSpace(in.SchoolID); v != "" {
			desired = &v
		}
	} else if update {
		set = true
		desired = existing
	}
	if !admin {
		if update && (existing == nil || *existing == "" || !managesSchool(ctx, db, userID, existing)) {
			return nil, 404, "Materi tidak ditemukan", false
		}
		if !set || desired == nil || !managesSchool(ctx, db, userID, desired) || !schoolActive(ctx, db, *desired) {
			if desired != nil && !managesSchool(ctx, db, userID, desired) {
				return nil, 400, "PGM tidak valid", false
			}
			if desired != nil && !schoolActive(ctx, db, *desired) {
				return nil, 400, "PGM tidak valid", false
			}
			return nil, 400, "PGM wajib dipilih", false
		}
		return desired, 0, "", true
	}
	if desired != nil && !schoolActive(ctx, db, *desired) {
		return nil, 400, "PGM tidak valid", false
	}
	return desired, 0, "", true
}

func managesSchool(ctx context.Context, db *pgxpool.Pool, userID string, schoolID *string) bool {
	if schoolID == nil || *schoolID == "" {
		return false
	}
	var ok bool
	_ = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, userID, *schoolID).Scan(&ok)
	return ok
}

func schoolActive(ctx context.Context, db *pgxpool.Pool, schoolID string) bool {
	var ok bool
	_ = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM "School" WHERE "id"=$1 AND "isActive"=true)`, schoolID).Scan(&ok)
	return ok
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

func namesForKept(existing, existingNames, keep []string) []string {
	byURL := make(map[string]string, len(existing))
	for i, u := range existing {
		n := ""
		if i < len(existingNames) {
			n = existingNames[i]
		}
		if n == "" {
			n = basenameURL(u)
		}
		byURL[u] = n
	}
	out := make([]string, 0, len(keep))
	for _, u := range keep {
		if n, ok := byURL[u]; ok && n != "" {
			out = append(out, n)
			continue
		}
		out = append(out, basenameURL(u))
	}
	return out
}

func basenameURL(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "file"
	}
	if u, err := url.Parse(s); err == nil && u.Path != "" {
		s = u.Path
	}
	s = strings.ReplaceAll(s, "\\", "/")
	return storage.DisplayFilename(path.Base(s))
}
