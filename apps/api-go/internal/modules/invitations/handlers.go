package invitations

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/domain/constants"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/email"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB     *pgxpool.Pool
	Config config.Config
}
type request struct {
	Name, Email, Role         string
	Gender, SchoolID, GroupID *string
}

func (h Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(h.Config))
	r.Post("/", h.create)
	r.Get("/", h.list)
	r.Post("/{id}/resend", h.resend)
	r.Delete("/{id}", h.cancel)
	return r
}

func admin(roles []string) bool {
	for _, r := range roles {
		if r == "ADMIN" || r == "SUPERADMIN" {
			return true
		}
	}
	return false
}

func (h Handler) assertSchoolAccess(r *http.Request, schoolID string) bool {
	claims, _ := middleware.Claims(r)
	if admin(claims.Roles) {
		return true
	}
	var ok bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, claims.UserID, schoolID).Scan(&ok)
	return ok
}

func (h Handler) assertGroupAccess(r *http.Request, groupID string) bool {
	claims, _ := middleware.Claims(r)
	if admin(claims.Roles) {
		return true
	}
	var owner, school string
	if h.DB.QueryRow(r.Context(), `SELECT "pembinaId","schoolId" FROM "Group" WHERE "id"=$1`, groupID).Scan(&owner, &school) != nil {
		return false
	}
	if owner == claims.UserID {
		return true
	}
	var ok bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, claims.UserID, school).Scan(&ok)
	return ok
}

func (h Handler) create(w http.ResponseWriter, r *http.Request) {
	var in request
	if json.NewDecoder(r.Body).Decode(&in) != nil || len(in.Name) < 2 || in.Email == "" || !validRole(in.Role) {
		httpx.Error(w, 400, "Data undangan tidak valid")
		return
	}
	claims, _ := middleware.Claims(r)
	if !constants.CanInvite(claims.Roles, in.Role) {
		httpx.Error(w, 403, "Anda tidak berhak mengundang role ini")
		return
	}
	if in.Role == "PEMBINA" || in.Role == "ANGGOTA" || in.Role == "PJ_SEKOLAH" {
		if in.Gender == nil || !validGender(*in.Gender) {
			httpx.Error(w, 400, "Jenis kelamin wajib dipilih")
			return
		}
	}
	if in.SchoolID != nil && *in.SchoolID != "" && !h.assertSchoolAccess(r, *in.SchoolID) {
		httpx.Error(w, 403, "Akses sekolah ditolak")
		return
	}
	if in.GroupID != nil && in.Role == "ANGGOTA" {
		if !h.assertGroupAccess(r, *in.GroupID) {
			httpx.Error(w, 403, "Akses kelompok ditolak")
			return
		}
		var gender string
		var active bool
		if h.DB.QueryRow(r.Context(), `SELECT "gender"::text,"isActive" FROM "Group" WHERE "id"=$1`, *in.GroupID).Scan(&gender, &active) != nil || !active {
			httpx.Error(w, 404, "Kelompok tidak ditemukan")
			return
		}
		if in.Gender == nil {
			in.Gender = &gender
		}
		if *in.Gender != gender {
			httpx.Error(w, 400, "Jenis kelamin Anggota harus sesuai kelompok")
			return
		}
	}
	if h.pendingInvitation(r, in.Email) {
		httpx.Error(w, 400, "Email sudah memiliki undangan aktif")
		return
	}
	existingUser := h.activeUser(r, in.Email)
	if existingUser && h.userHasRole(r, in.Email, in.Role) {
		httpx.Error(w, 400, "User sudah memiliki role ini")
		return
	}
	id, token := uuid.NewString(), uuid.NewString()
	expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
	_, err := h.DB.Exec(r.Context(), `INSERT INTO "UserInvitation" ("id","name","email","role","gender","schoolId","groupId","token","invitedById","expiresAt") VALUES ($1,$2,$3,$4::"Role",$5::"Gender",$6,$7,$8,$9,$10)`, id, in.Name, in.Email, in.Role, in.Gender, in.SchoolID, in.GroupID, token, claims.UserID, expires)
	if err != nil {
		httpx.Error(w, 500, "Gagal membuat undangan")
		return
	}
	link := h.Config.AppURL + "/set-password?token=" + token
	if existingUser {
		link = h.Config.AppURL + "/accept-role?token=" + token
	}
	if err := email.New(h.Config).SendInvitationWithKind(r.Context(), in.Email, in.Name, link, existingUser); err != nil {
		httpx.Error(w, 502, "Undangan dibuat, namun email gagal dikirim")
		return
	}
	msg := "Undangan berhasil dikirim"
	if existingUser {
		msg = "Undangan peran tambahan berhasil dikirim"
	}
	httpx.Success(w, 201, map[string]any{"id": id, "name": in.Name, "email": in.Email, "role": in.Role, "gender": in.Gender, "schoolId": in.SchoolID, "groupId": in.GroupID, "status": "PENDING", "expiresAt": expires, "existingUser": existingUser}, msg)
}

func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.Claims(r)
	page, limit := pagination(r)
	var total int
	if h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "UserInvitation" WHERE "invitedById"=$1`, claims.UserID).Scan(&total) != nil {
		httpx.Error(w, 500, "Gagal mengambil undangan")
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT "id","name","email","role"::text,"gender"::text,"schoolId","groupId","status"::text,"expiresAt","createdAt" FROM "UserInvitation" WHERE "invitedById"=$1 ORDER BY "createdAt" DESC OFFSET $2 LIMIT $3`, claims.UserID, (page-1)*limit, limit)
	if err != nil {
		httpx.Error(w, 500, "Gagal mengambil undangan")
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, name, mail, role, status string
		var gender, school, group *string
		var expires, created time.Time
		if rows.Scan(&id, &name, &mail, &role, &gender, &school, &group, &status, &expires, &created) == nil {
			items = append(items, map[string]any{"id": id, "name": name, "email": mail, "role": role, "gender": gender, "schoolId": school, "groupId": group, "status": status, "expiresAt": expires, "createdAt": created})
		}
	}
	httpx.Paginated(w, items, page, limit, total)
}

func (h Handler) resend(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.Claims(r)
	id := chi.URLParam(r, "id")
	var name, mail, token string
	err := h.DB.QueryRow(r.Context(), `SELECT "name","email","token" FROM "UserInvitation" WHERE "id"=$1 AND "invitedById"=$2`, id, claims.UserID).Scan(&name, &mail, &token)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "Undangan tidak ditemukan")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "Gagal mengirim ulang undangan")
		return
	}
	expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
	if _, err = h.DB.Exec(r.Context(), `UPDATE "UserInvitation" SET "status"='PENDING',"expiresAt"=$1 WHERE "id"=$2`, expires, id); err != nil {
		httpx.Error(w, 500, "Gagal mengirim ulang undangan")
		return
	}
	existingUser := h.activeUser(r, mail)
	link := h.Config.AppURL + "/set-password?token=" + token
	if existingUser {
		link = h.Config.AppURL + "/accept-role?token=" + token
	}
	if err = email.New(h.Config).SendInvitationWithKind(r.Context(), mail, name, link, existingUser); err != nil {
		httpx.Error(w, 502, "Undangan diperbarui, namun email gagal dikirim")
		return
	}
	httpx.Success(w, 200, map[string]any{"id": id, "expiresAt": expires}, "Undangan berhasil dikirim ulang")
}
func (h Handler) cancel(w http.ResponseWriter, r *http.Request) {
	claims, _ := middleware.Claims(r)
	tag, err := h.DB.Exec(r.Context(), `DELETE FROM "UserInvitation" WHERE "id"=$1 AND "invitedById"=$2 AND "status"='PENDING'`, chi.URLParam(r, "id"), claims.UserID)
	if err != nil {
		httpx.Error(w, 500, "Gagal membatalkan undangan")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "Undangan tidak ditemukan")
		return
	}
	httpx.Success(w, 200, nil, "Undangan dibatalkan")
}
func (h Handler) pendingInvitation(r *http.Request, email string) bool {
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserInvitation" WHERE "email"=$1 AND "status"='PENDING' AND "expiresAt">NOW())`, email).Scan(&exists)
	return exists
}

func (h Handler) activeUser(r *http.Request, email string) bool {
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" WHERE "email"=$1 AND "isActive")`, email).Scan(&exists)
	return exists
}

func (h Handler) userHasRole(r *http.Request, email, role string) bool {
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" u JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."email"=$1 AND ur."role"=$2::"Role")`, email, role).Scan(&exists)
	return exists
}
func validRole(v string) bool {
	for _, x := range constants.Roles {
		if x == v {
			return true
		}
	}
	return false
}
func validGender(v string) bool { return v == "IKHWAN" || v == "AKHWAT" }
func pagination(r *http.Request) (int, int) {
	p, _ := strconv.Atoi(r.URL.Query().Get("page"))
	l, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if p < 1 {
		p = 1
	}
	if l < 1 || l > 100 {
		l = 20
	}
	return p, l
}
