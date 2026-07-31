package users

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

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/leaderboard", leaderboard(db))
	r.Get("/me", me(db))
	r.Put("/me", updateMe(db))
	r.With(middleware.RequireRole("SUPERADMIN")).Get("/", list(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Post("/{id}/roles", addRole(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Delete("/{id}/roles/{role}", removeRole(db))
	r.Get("/{id}", get(db))
	r.With(middleware.RequireRole("SUPERADMIN")).Put("/{id}", update(db))
	r.With(middleware.RequireRole("SUPERADMIN")).Delete("/{id}", remove(db))
	return r
}

func page(r *http.Request) (int, int) {
	p, l := 1, 20
	if n, e := strconv.Atoi(r.URL.Query().Get("page")); e == nil && n > 0 {
		p = n
	}
	if n, e := strconv.Atoi(r.URL.Query().Get("limit")); e == nil && n > 0 && n <= 100 {
		l = n
	}
	return p, l
}
func roles(db *pgxpool.Pool, r *http.Request, id string) []map[string]string {
	rows, e := db.Query(r.Context(), `SELECT "role"::text FROM "UserRole" WHERE "userId"=$1`, id)
	if e != nil {
		return []map[string]string{}
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var v string
		if rows.Scan(&v) == nil {
			out = append(out, map[string]string{"role": v})
		}
	}
	return out
}
func schools(db *pgxpool.Pool, r *http.Request, id string) []map[string]any {
	rows, e := db.Query(r.Context(), `SELECT s."id",s."name" FROM "UserSchool" us JOIN "School" s ON s."id"=us."schoolId" WHERE us."userId"=$1`, id)
	if e != nil {
		return []map[string]any{}
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var i, n string
		if rows.Scan(&i, &n) == nil {
			out = append(out, map[string]any{"school": map[string]string{"id": i, "name": n}})
		}
	}
	return out
}
func user(db *pgxpool.Pool, r *http.Request, id string) (map[string]any, error) {
	var name, email string
	var phone, avatar *string
	var points int
	var active bool
	var created time.Time
	var login *time.Time
	e := db.QueryRow(r.Context(), `SELECT "name","email","phone","avatarUrl","totalPoints","isActive","createdAt","lastLoginAt" FROM "User" WHERE "id"=$1`, id).Scan(&name, &email, &phone, &avatar, &points, &active, &created, &login)
	if e != nil {
		return nil, e
	}
	return map[string]any{"id": id, "name": name, "email": email, "phone": phone, "avatarUrl": avatar, "totalPoints": points, "isActive": active, "createdAt": created, "lastLoginAt": login, "roles": roles(db, r, id), "schools": schools(db, r, id)}, nil
}
func me(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		u, e := user(db, r, c.UserID)
		if e != nil {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		httpx.Success(w, 200, u, "")
	}
}
func updateMe(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		var in struct {
			Name   *string `json:"name"`
			Phone  *string `json:"phone"`
			Avatar *string `json:"avatarUrl"`
		}
		if json.NewDecoder(r.Body).Decode(&in) != nil {
			httpx.Error(w, 400, "Body tidak valid")
			return
		}
		_, e := db.Exec(r.Context(), `UPDATE "User" SET "name"=COALESCE($1,"name"),"phone"=COALESCE($2,"phone"),"avatarUrl"=COALESCE($3,"avatarUrl"),"updatedAt"=NOW() WHERE "id"=$4`, in.Name, in.Phone, in.Avatar, c.UserID)
		if e != nil {
			httpx.Error(w, 500, "Gagal memperbarui profil")
			return
		}
		u, _ := user(db, r, c.UserID)
		httpx.Success(w, 200, u, "Profil berhasil diperbarui")
	}
}
func leaderboard(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, l := page(r)
		where := `u."isActive" AND EXISTS(SELECT 1 FROM "UserRole" ur WHERE ur."userId"=u."id" AND ur."role" IN ('PEMBINA'::"Role",'ANGGOTA'::"Role"))`
		var total int
		if db.QueryRow(r.Context(), `SELECT count(*) FROM "User" u WHERE `+where).Scan(&total) != nil {
			httpx.Error(w, 500, "Gagal memuat leaderboard")
			return
		}
		rows, e := db.Query(r.Context(), `SELECT u."id",u."name",u."totalPoints" FROM "User" u WHERE `+where+` ORDER BY u."totalPoints" DESC OFFSET $1 LIMIT $2`, (p-1)*l, l)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat leaderboard")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, n string
			var points int
			if rows.Scan(&id, &n, &points) == nil {
				out = append(out, map[string]any{"id": id, "name": n, "totalPoints": points, "roles": roles(db, r, id)})
			}
		}
		httpx.Paginated(w, out, p, l, total)
	}
}
func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, l := page(r)
		var total int
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "User"`).Scan(&total)
		rows, e := db.Query(r.Context(), `SELECT "id" FROM "User" ORDER BY "createdAt" DESC OFFSET $1 LIMIT $2`, (p-1)*l, l)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat user")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil {
				if u, e := user(db, r, id); e == nil {
					out = append(out, u)
				}
			}
		}
		httpx.Paginated(w, out, p, l, total)
	}
}
func get(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		c, _ := middleware.Claims(r)
		u, e := user(db, r, id)
		if e != nil {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		if !has(c.Roles, "SUPERADMIN") && !has(c.Roles, "ADMIN") {
			if !has(c.Roles, "PJ_SEKOLAH") || !sharedSchool(db, r, c.UserID, id) {
				httpx.Error(w, 403, "Akses ditolak")
				return
			}
		}
		httpx.Success(w, 200, u, "")
	}
}
func sharedSchool(db *pgxpool.Pool, r *http.Request, a, b string) bool {
	var ok bool
	_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" a JOIN "UserSchool" b ON a."schoolId"=b."schoolId" WHERE a."userId"=$1 AND b."userId"=$2)`, a, b).Scan(&ok)
	return ok
}
func update(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Name     *string `json:"name"`
			Phone    *string `json:"phone"`
			IsActive *bool   `json:"isActive"`
		}
		if json.NewDecoder(r.Body).Decode(&in) != nil {
			httpx.Error(w, 400, "Body tidak valid")
			return
		}
		id := chi.URLParam(r, "id")
		tag, e := db.Exec(r.Context(), `UPDATE "User" SET "name"=COALESCE($1,"name"),"phone"=COALESCE($2,"phone"),"isActive"=COALESCE($3,"isActive"),"updatedAt"=NOW() WHERE "id"=$4`, in.Name, in.Phone, in.IsActive, id)
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		u, _ := user(db, r, id)
		httpx.Success(w, 200, u, "User berhasil diperbarui")
	}
}
func remove(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tag, e := db.Exec(r.Context(), `UPDATE "User" SET "isActive"=false,"updatedAt"=NOW() WHERE "id"=$1`, chi.URLParam(r, "id"))
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "User dinonaktifkan")
	}
}

func validAssignableRole(role string) bool {
	switch role {
	case "ADMIN", "PJ_SEKOLAH", "PEMBINA", "ANGGOTA":
		return true
	default:
		return false
	}
}

func addRole(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		id := chi.URLParam(r, "id")
		var in struct {
			Role          string  `json:"role"`
			SchoolID      *string `json:"schoolId"`
			GroupID       *string `json:"groupId"`
			AlsoAsPembina *bool   `json:"alsoAsPembina"`
		}
		if json.NewDecoder(r.Body).Decode(&in) != nil || !validAssignableRole(in.Role) {
			httpx.Error(w, 400, "Role tidak valid")
			return
		}
		if !constants.CanInvite(claims.Roles, in.Role) {
			httpx.Error(w, 403, "Anda tidak berhak menambahkan role ini")
			return
		}
		var exists bool
		if db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" WHERE "id"=$1 AND "isActive")`, id).Scan(&exists) != nil || !exists {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		if db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserRole" WHERE "userId"=$1 AND "role"=$2::"Role")`, id, in.Role).Scan(&exists) == nil && exists {
			httpx.Error(w, 400, "User sudah memiliki role ini")
			return
		}
		withPembina := (in.Role == "ADMIN" || in.Role == "PJ_SEKOLAH") && (in.AlsoAsPembina == nil || *in.AlsoAsPembina)
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal menambahkan role")
			return
		}
		defer tx.Rollback(r.Context())
		if _, err = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,$3::"Role")`, uuid.NewString(), id, in.Role); err != nil {
			httpx.Error(w, 500, "Gagal menambahkan role")
			return
		}
		if withPembina {
			_, _ = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") SELECT $1,$2,'PEMBINA'::"Role" WHERE NOT EXISTS (SELECT 1 FROM "UserRole" WHERE "userId"=$2 AND "role"='PEMBINA'::"Role")`, uuid.NewString(), id)
		}
		if in.SchoolID != nil && *in.SchoolID != "" && (in.Role == "PJ_SEKOLAH" || in.Role == "PEMBINA" || in.Role == "ANGGOTA") {
			var schoolOK bool
			if tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "School" WHERE "id"=$1 AND "isActive")`, *in.SchoolID).Scan(&schoolOK) != nil || !schoolOK {
				httpx.Error(w, 400, "Sekolah tidak valid")
				return
			}
			_, _ = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "UserSchool" WHERE "userId"=$2 AND "schoolId"=$3)`, uuid.NewString(), id, *in.SchoolID)
		}
		if in.GroupID != nil && *in.GroupID != "" && in.Role == "ANGGOTA" {
			var groupOK bool
			if tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "Group" WHERE "id"=$1 AND "isActive")`, *in.GroupID).Scan(&groupOK) != nil || !groupOK {
				httpx.Error(w, 400, "Kelompok tidak valid")
				return
			}
			_, _ = tx.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "GroupMember" WHERE "groupId"=$2 AND "userId"=$3)`, uuid.NewString(), *in.GroupID, id)
		}
		if tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal menambahkan role")
			return
		}
		u, _ := user(db, r, id)
		httpx.Success(w, 200, u, "Role berhasil ditambahkan")
	}
}

func removeRole(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := middleware.Claims(r)
		id := chi.URLParam(r, "id")
		role := chi.URLParam(r, "role")
		if !validAssignableRole(role) && role != "SUPERADMIN" {
			httpx.Error(w, 400, "Role tidak valid")
			return
		}
		if role == "SUPERADMIN" {
			httpx.Error(w, 400, "Role SUPERADMIN tidak dapat dihapus lewat endpoint ini")
			return
		}
		if !constants.CanInvite(claims.Roles, role) {
			httpx.Error(w, 403, "Anda tidak berhak menghapus role ini")
			return
		}
		var count int
		if db.QueryRow(r.Context(), `SELECT count(*) FROM "UserRole" WHERE "userId"=$1`, id).Scan(&count) != nil || count == 0 {
			httpx.Error(w, 404, "User tidak ditemukan")
			return
		}
		if count <= 1 {
			httpx.Error(w, 400, "Tidak dapat menghapus role terakhir user")
			return
		}
		tag, e := db.Exec(r.Context(), `DELETE FROM "UserRole" WHERE "userId"=$1 AND "role"=$2::"Role"`, id, role)
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Role tidak ditemukan pada user")
			return
		}
		u, _ := user(db, r, id)
		httpx.Success(w, 200, u, "Role berhasil dihapus")
	}
}

func has(roles []string, wanted string) bool {
	for _, r := range roles {
		if r == wanted {
			return true
		}
	}
	return false
}

var _ = pgx.ErrNoRows
