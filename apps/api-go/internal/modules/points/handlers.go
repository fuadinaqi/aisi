package points

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

type pointLog struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Points      int       `json:"points"`
	Description string    `json:"description"`
	RefType     *string   `json:"refType"`
	RefID       *string   `json:"refId"`
	CreatedAt   time.Time `json:"createdAt"`
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/me", mine(db))
	r.Get("/leaderboard", leaderboard(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH", "PEMBINA")).Post("/manual", manual(db))
	return r
}

func mine(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		if !constants.IsPointEligible(claims.Roles) {
			httpx.Success(w, 200, map[string]any{"totalPoints": 0, "logs": []pointLog{}, "eligible": false}, "")
			return
		}
		page, limit := pagination(r)
		rows, err := db.Query(r.Context(), `SELECT "id","userId","points","description","refType","refId","createdAt" FROM "PointLog" WHERE "userId"=$1 ORDER BY "createdAt" DESC OFFSET $2 LIMIT $3`, claims.UserID, (page-1)*limit, limit)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat poin")
			return
		}
		defer rows.Close()
		logs := []pointLog{}
		for rows.Next() {
			var log pointLog
			if err := rows.Scan(&log.ID, &log.UserID, &log.Points, &log.Description, &log.RefType, &log.RefID, &log.CreatedAt); err != nil {
				httpx.Error(w, 500, "Gagal memuat poin")
				return
			}
			logs = append(logs, log)
		}
		var total, totalPoints int
		if err := db.QueryRow(r.Context(), `SELECT (SELECT count(*) FROM "PointLog" WHERE "userId"=$1), "totalPoints" FROM "User" WHERE "id"=$1`, claims.UserID).Scan(&total, &totalPoints); err != nil {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		httpx.Paginated(w, map[string]any{"totalPoints": totalPoints, "logs": logs, "eligible": true}, page, limit, total)
	}
}

func leaderboard(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, limit := pagination(r)
		const where = `u."isActive"=true AND EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId"=u."id" AND ur."role" IN ('PEMBINA'::"Role",'ANGGOTA'::"Role"))`
		rows, err := db.Query(r.Context(), `SELECT u."id",u."name",u."totalPoints",COALESCE((SELECT json_agg(json_build_object('role',ur."role"::text)) FROM "UserRole" ur WHERE ur."userId"=u."id"),'[]'::json) FROM "User" u WHERE `+where+` ORDER BY u."totalPoints" DESC OFFSET $1 LIMIT $2`, (page-1)*limit, limit)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat leaderboard")
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, name string
			var totalPoints int
			var roles json.RawMessage
			if err := rows.Scan(&id, &name, &totalPoints, &roles); err != nil {
				httpx.Error(w, 500, "Gagal memuat leaderboard")
				return
			}
			items = append(items, map[string]any{"id": id, "name": name, "totalPoints": totalPoints, "roles": roles})
		}
		var total int
		if err := db.QueryRow(r.Context(), `SELECT count(*) FROM "User" u WHERE `+where).Scan(&total); err != nil {
			httpx.Error(w, 500, "Gagal memuat leaderboard")
			return
		}
		httpx.Paginated(w, items, page, limit, total)
	}
}

func manual(db *pgxpool.Pool) http.HandlerFunc {
	type request struct {
		UserID      string `json:"userId"`
		Points      int    `json:"points"`
		Description string `json:"description"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		var in request
		if json.NewDecoder(r.Body).Decode(&in) != nil || in.UserID == "" || in.Points <= 0 || in.Description == "" {
			httpx.Error(w, 400, "userId, poin positif, dan deskripsi wajib diisi")
			return
		}
		var targetRoles []string
		err := db.QueryRow(r.Context(), `SELECT COALESCE(array_agg(ur."role"::text) FILTER (WHERE ur."role" IS NOT NULL),'{}') FROM "User" u LEFT JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 GROUP BY u."id"`, in.UserID).Scan(&targetRoles)
		if err != nil {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		if !constants.IsPointEligible(targetRoles) {
			httpx.Error(w, 400, "Poin hanya berlaku untuk Pembina dan Anggota")
			return
		}
		if err := canGrant(r, db, claims.UserID, claims.Roles, in.UserID, targetRoles); err != "" {
			httpx.Error(w, 403, err)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal menambahkan poin")
			return
		}
		defer tx.Rollback(r.Context())
		_, err = tx.Exec(r.Context(), `INSERT INTO "PointLog" ("id","userId","points","description","refType","refId") VALUES ($1,$2,$3,$4,'MANUAL',$5)`, uuid.NewString(), in.UserID, in.Points, in.Description, claims.UserID)
		if err == nil {
			_, err = tx.Exec(r.Context(), `UPDATE "User" SET "totalPoints"="totalPoints"+$1,"updatedAt"=NOW() WHERE "id"=$2`, in.Points, in.UserID)
		}
		if err != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal menambahkan poin")
			return
		}
		httpx.Success(w, 200, nil, "Poin berhasil ditambahkan")
	}
}

func canGrant(r *http.Request, db *pgxpool.Pool, grantorID string, grantorRoles []string, targetID string, targetRoles []string) string {
	if grantorID == targetID {
		return "Tidak bisa menambah poin untuk diri sendiri"
	}
	if !constants.CanGrantManualPoints(grantorRoles, targetRoles) {
		return "Anda tidak berhak menambah poin untuk user ini"
	}
	targetRole := constants.GetPointEligibleTargetRole(targetRoles)
	if hasRole(grantorRoles, "SUPERADMIN") || hasRole(grantorRoles, "ADMIN") {
		return ""
	}
	var count int
	if hasRole(grantorRoles, "PJ_SEKOLAH") {
		query := `SELECT count(*) FROM "UserSchool" us WHERE us."userId"=$1 AND EXISTS (SELECT 1 FROM "Group" g WHERE g."schoolId"=us."schoolId" AND `
		if targetRole == "PEMBINA" {
			query += `g."pembinaId"=$2)`
		} else {
			query += `EXISTS (SELECT 1 FROM "GroupMember" gm WHERE gm."groupId"=g."id" AND gm."userId"=$2))`
		}
		_ = db.QueryRow(r.Context(), query, grantorID, targetID).Scan(&count)
	} else if hasRole(grantorRoles, "PEMBINA") {
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."userId"=$1 AND g."pembinaId"=$2`, targetID, grantorID).Scan(&count)
	}
	if count == 0 {
		return "User target di luar cakupan Anda"
	}
	return ""
}

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

var _ = pgx.ErrNoRows
