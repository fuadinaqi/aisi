package kks

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/domain/constants"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type feedback struct {
	ID         string          `json:"id"`
	UserID     string          `json:"userId"`
	Type       string          `json:"type"`
	Subject    string          `json:"subject"`
	Message    string          `json:"message"`
	Status     string          `json:"status"`
	AdminNotes *string         `json:"adminNotes"`
	SchoolID   *string         `json:"schoolId"`
	CreatedAt  time.Time       `json:"createdAt"`
	UpdatedAt  time.Time       `json:"updatedAt"`
	ReadAt     *time.Time      `json:"readAt"`
	ResolvedAt *time.Time      `json:"resolvedAt"`
	User       json.RawMessage `json:"user"`
}

const feedbackColumns = `f."id",f."userId",f."type"::text,f."subject",f."message",f."status"::text,f."adminNotes",f."schoolId",f."createdAt",f."updatedAt",f."readAt",f."resolvedAt",
json_build_object('id',u."id",'name',u."name",'email',u."email",'phone',u."phone",
'roles',COALESCE((SELECT json_agg(json_build_object('role',ur."role"::text)) FROM "UserRole" ur WHERE ur."userId"=u."id"),'[]'::json),
'schools',COALESCE((SELECT json_agg(json_build_object('school',json_build_object('id',s."id",'name',s."name"))) FROM "UserSchool" us JOIN "School" s ON s."id"=us."schoolId" WHERE us."userId"=u."id"),'[]'::json))`

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Post("/", create(db))
	r.Get("/{id}", detail(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Put("/{id}", update(db))
	return r
}

func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		page, limit := pagination(r)
		args := []any{}
		where := ""
		isAdmin := hasRole(claims.Roles, "SUPERADMIN") || hasRole(claims.Roles, "ADMIN")
		if r.URL.Query().Get("mine") == "true" || !isAdmin {
			args = append(args, claims.UserID)
			where += `f."userId"=$` + strconv.Itoa(len(args))
		}
		if status := r.URL.Query().Get("status"); status != "" {
			if !validStatus(status) {
				httpx.Error(w, 400, "Status KKS tidak valid")
				return
			}
			if where != "" {
				where += " AND "
			}
			args = append(args, status)
			where += `f."status"=$` + strconv.Itoa(len(args)) + `::"FeedbackStatus"`
		}
		if kind := r.URL.Query().Get("type"); kind != "" {
			if !validType(kind) {
				httpx.Error(w, 400, "Tipe KKS tidak valid")
				return
			}
			if where != "" {
				where += " AND "
			}
			args = append(args, kind)
			where += `f."type"=$` + strconv.Itoa(len(args)) + `::"FeedbackType"`
		}
		if where != "" {
			where = " WHERE " + where
		}
		args = append(args, (page-1)*limit, limit)
		rows, err := db.Query(r.Context(), `SELECT `+feedbackColumns+` FROM "Feedback" f JOIN "User" u ON u."id"=f."userId"`+where+` ORDER BY f."createdAt" DESC OFFSET $`+strconv.Itoa(len(args)-1)+` LIMIT $`+strconv.Itoa(len(args)), args...)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat KKS")
			return
		}
		defer rows.Close()
		items, err := scanFeedbacks(rows)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat KKS")
			return
		}
		countArgs := args[:len(args)-2]
		var total, pending int
		if err := db.QueryRow(r.Context(), `SELECT count(*) FROM "Feedback" f`+where, countArgs...).Scan(&total); err != nil {
			httpx.Error(w, 500, "Gagal memuat KKS")
			return
		}
		if isAdmin {
			err = db.QueryRow(r.Context(), `SELECT count(*) FROM "Feedback" WHERE "status"='PENDING'`).Scan(&pending)
		} else {
			err = db.QueryRow(r.Context(), `SELECT count(*) FROM "Feedback" WHERE "userId"=$1 AND "status"='PENDING'`, claims.UserID).Scan(&pending)
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat KKS")
			return
		}
		httpx.Paginated(w, map[string]any{"items": items, "pendingCount": pending}, page, limit, total)
	}
}

func detail(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		var item feedback
		err := db.QueryRow(r.Context(), `SELECT `+feedbackColumns+` FROM "Feedback" f JOIN "User" u ON u."id"=f."userId" WHERE f."id"=$1`, chi.URLParam(r, "id")).Scan(&item.ID, &item.UserID, &item.Type, &item.Subject, &item.Message, &item.Status, &item.AdminNotes, &item.SchoolID, &item.CreatedAt, &item.UpdatedAt, &item.ReadAt, &item.ResolvedAt, &item.User)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "KKS tidak ditemukan")
			return
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat KKS")
			return
		}
		if !hasRole(claims.Roles, "SUPERADMIN") && !hasRole(claims.Roles, "ADMIN") && item.UserID != claims.UserID {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		httpx.Success(w, 200, item, "")
	}
}

func create(db *pgxpool.Pool) http.HandlerFunc {
	type request struct {
		Type    string `json:"type"`
		Subject string `json:"subject"`
		Message string `json:"message"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		var in request
		if json.NewDecoder(r.Body).Decode(&in) != nil || !validType(in.Type) || len(in.Subject) < 3 || len(in.Subject) > 200 || len(in.Message) < 10 || len(in.Message) > 5000 {
			httpx.Error(w, 400, "Data KKS tidak valid")
			return
		}
		var schoolID *string
		_ = db.QueryRow(r.Context(), `SELECT "schoolId" FROM "UserSchool" WHERE "userId"=$1 ORDER BY "schoolId" LIMIT 1`, claims.UserID).Scan(&schoolID)
		var item feedback
		err := db.QueryRow(r.Context(), `INSERT INTO "Feedback" ("id","userId","type","subject","message","schoolId","updatedAt") VALUES ($1,$2,$3::"FeedbackType",$4,$5,$6,NOW()) RETURNING "id","userId","type"::text,"subject","message","status"::text,"adminNotes","schoolId","createdAt","updatedAt","readAt","resolvedAt"`, uuid.NewString(), claims.UserID, in.Type, in.Subject, in.Message, schoolID).Scan(&item.ID, &item.UserID, &item.Type, &item.Subject, &item.Message, &item.Status, &item.AdminNotes, &item.SchoolID, &item.CreatedAt, &item.UpdatedAt, &item.ReadAt, &item.ResolvedAt)
		if err != nil {
			httpx.Error(w, 500, "Gagal mengirim KKS")
			return
		}
		_ = db.QueryRow(r.Context(), `SELECT `+feedbackColumns+` FROM "Feedback" f JOIN "User" u ON u."id"=f."userId" WHERE f."id"=$1`, item.ID).Scan(&item.ID, &item.UserID, &item.Type, &item.Subject, &item.Message, &item.Status, &item.AdminNotes, &item.SchoolID, &item.CreatedAt, &item.UpdatedAt, &item.ReadAt, &item.ResolvedAt, &item.User)
		admins, err := db.Query(r.Context(), `SELECT DISTINCT "userId" FROM "UserRole" WHERE "role" IN ('SUPERADMIN'::"Role",'ADMIN'::"Role")`)
		if err == nil {
			defer admins.Close()
			for admins.Next() {
				var adminID string
				if admins.Scan(&adminID) == nil {
					_, _ = db.Exec(r.Context(), `INSERT INTO "Notification" ("id","userId","type","title","body","refId") VALUES ($1,$2,'NEW_KKS'::"NotifType",$3,$4,$5)`, uuid.NewString(), adminID, constants.KKSTypeLabels[in.Type]+" baru", in.Subject, item.ID)
				}
			}
		}
		httpx.Success(w, 201, item, "KKS berhasil dikirim")
	}
}

func update(db *pgxpool.Pool) http.HandlerFunc {
	type request struct {
		Status     *string         `json:"status"`
		AdminNotes json.RawMessage `json:"adminNotes"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var in request
		if json.NewDecoder(r.Body).Decode(&in) != nil || (in.Status == nil && in.AdminNotes == nil) || (in.Status != nil && !validStatus(*in.Status)) {
			httpx.Error(w, 400, "Data KKS tidak valid")
			return
		}
		var adminNotes *string
		if in.AdminNotes != nil && string(in.AdminNotes) != "null" {
			var value string
			if json.Unmarshal(in.AdminNotes, &value) != nil || len(value) > 5000 {
				httpx.Error(w, 400, "Data KKS tidak valid")
				return
			}
			adminNotes = &value
		}
		id := chi.URLParam(r, "id")
		var oldStatus string
		var readAt, resolvedAt *time.Time
		if err := db.QueryRow(r.Context(), `SELECT "status"::text,"readAt","resolvedAt" FROM "Feedback" WHERE "id"=$1`, id).Scan(&oldStatus, &readAt, &resolvedAt); err == pgx.ErrNoRows {
			httpx.Error(w, 404, "KKS tidak ditemukan")
			return
		} else if err != nil {
			httpx.Error(w, 500, "Gagal memperbarui KKS")
			return
		}
		status := oldStatus
		if in.Status != nil {
			status = *in.Status
		}
		if status == "PENDING" {
			readAt = nil
		} else if readAt == nil {
			now := time.Now()
			readAt = &now
		}
		if status == "PENDING" {
			resolvedAt = nil
		} else if status == "RESOLVED" {
			now := time.Now()
			resolvedAt = &now
		}
		var notes any = nil
		if in.AdminNotes != nil {
			notes = adminNotes
		}
		_, err := db.Exec(r.Context(), `UPDATE "Feedback" SET "status"=$1::"FeedbackStatus","adminNotes"=CASE WHEN $2::boolean THEN $3 ELSE "adminNotes" END,"readAt"=$4,"resolvedAt"=$5,"updatedAt"=NOW() WHERE "id"=$6`, status, in.AdminNotes != nil, notes, readAt, resolvedAt, id)
		if err != nil {
			httpx.Error(w, 500, "Gagal memperbarui KKS")
			return
		}
		detail(db).ServeHTTP(w, r)
	}
}

func scanFeedbacks(rows pgx.Rows) ([]feedback, error) {
	items := []feedback{}
	for rows.Next() {
		var item feedback
		if err := rows.Scan(&item.ID, &item.UserID, &item.Type, &item.Subject, &item.Message, &item.Status, &item.AdminNotes, &item.SchoolID, &item.CreatedAt, &item.UpdatedAt, &item.ReadAt, &item.ResolvedAt, &item.User); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func validType(v string) bool   { _, ok := constants.KKSTypeLabels[v]; return ok }
func validStatus(v string) bool { _, ok := constants.KKSStatusLabels[v]; return ok }
func hasRole(roles []string, wanted string) bool {
	for _, role := range roles {
		if role == wanted {
			return true
		}
	}
	return false
}
func pagination(r *http.Request) (int, int) {
	page, limit := 1, 20
	if n, e := strconv.Atoi(r.URL.Query().Get("page")); e == nil && n > 0 {
		page = n
	}
	if n, e := strconv.Atoi(r.URL.Query().Get("limit")); e == nil && n > 0 && n <= 100 {
		limit = n
	}
	return page, limit
}
