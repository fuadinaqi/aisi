package authmodule

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/auth"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
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

func (h Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.With(loginLimit.Middleware).Post("/login", h.login)
	r.Post("/logout", h.logout)
	r.Post("/refresh", h.refresh)
	r.With(middleware.RequireAuth(h.Config)).Post("/change-password", h.changePassword)
	r.Get("/invitation/{token}", h.invitation)
	r.Post("/set-password", h.setPassword)
	return r
}

var loginLimit = middleware.NewRateLimit(5, 15*time.Minute)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type user struct {
	ID, Name, Email, Password string
	TotalPoints               int
	Active                    bool
	Roles                     []string
}

func (h Handler) getUser(ctx context.Context, email string) (user, error) {
	var u user
	err := h.DB.QueryRow(ctx, `SELECT u."id",u."name",u."email",u."password",u."totalPoints",u."isActive",COALESCE(array_agg(ur."role"::text) FILTER (WHERE ur."role" IS NOT NULL),'{}') FROM "User" u LEFT JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."email"=$1 GROUP BY u."id"`, email).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.TotalPoints, &u.Active, &u.Roles)
	return u, err
}
func decode(r *http.Request, target any) error { return json.NewDecoder(r.Body).Decode(target) }

func (h Handler) login(w http.ResponseWriter, r *http.Request) {
	var in loginRequest
	if err := decode(r, &in); err != nil || in.Email == "" || in.Password == "" {
		httpx.Error(w, 400, "Email dan password wajib diisi")
		return
	}
	u, err := h.getUser(r.Context(), in.Email)
	if err != nil || !u.Active || auth.CheckPassword(u.Password, in.Password) != nil {
		httpx.Error(w, 401, "Email atau password salah")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `UPDATE "User" SET "lastLoginAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1`, u.ID)
	access, err := auth.AccessToken(h.Config, u.ID, u.Email, u.Roles)
	if err != nil {
		httpx.Error(w, 500, "Gagal membuat token")
		return
	}
	refresh, err := h.createRefresh(r.Context(), u.ID)
	if err != nil {
		httpx.Error(w, 500, "Gagal membuat refresh token")
		return
	}
	h.setCookie(w, refresh)
	httpx.Success(w, 200, map[string]any{"accessToken": access, "user": map[string]any{"id": u.ID, "name": u.Name, "email": u.Email, "roles": u.Roles, "totalPoints": u.TotalPoints}}, "")
}

func (h Handler) createRefresh(ctx context.Context, userID string) (string, error) {
	id, signed, err := auth.NewRefreshToken(h.Config)
	if err != nil {
		return "", err
	}
	_, err = h.DB.Exec(ctx, `INSERT INTO "RefreshToken" ("id","userId","token","expiresAt") VALUES ($1,$2,$3,$4)`, uuid.NewString(), userID, id, time.Now().Add(h.Config.JWTRefreshExpires))
	return signed, err
}

func (h Handler) refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refreshToken")
	if err != nil {
		httpx.Error(w, 401, "Refresh token tidak ditemukan")
		return
	}
	claims, err := auth.ParseRefresh(h.Config, cookie.Value)
	if err != nil {
		httpx.Error(w, 401, "Refresh token tidak valid")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "Gagal memperbarui token")
		return
	}
	defer tx.Rollback(r.Context())
	var userID string
	err = tx.QueryRow(r.Context(), `DELETE FROM "RefreshToken" WHERE "token"=$1 AND "expiresAt">NOW() RETURNING "userId"`, claims.Token).Scan(&userID)
	if err != nil {
		httpx.Error(w, 401, "Refresh token tidak valid")
		return
	}
	var u user
	err = tx.QueryRow(r.Context(), `SELECT u."id",u."name",u."email",u."password",u."totalPoints",u."isActive",COALESCE(array_agg(ur."role"::text) FILTER (WHERE ur."role" IS NOT NULL),'{}') FROM "User" u LEFT JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 GROUP BY u."id"`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Password, &u.TotalPoints, &u.Active, &u.Roles)
	if err != nil || !u.Active {
		httpx.Error(w, 401, "User tidak ditemukan")
		return
	}
	tokenID, signed, err := auth.NewRefreshToken(h.Config)
	if err != nil {
		httpx.Error(w, 500, "Gagal memperbarui token")
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO "RefreshToken" ("id","userId","token","expiresAt") VALUES ($1,$2,$3,$4)`, uuid.NewString(), u.ID, tokenID, time.Now().Add(h.Config.JWTRefreshExpires))
	if err != nil {
		httpx.Error(w, 500, "Gagal memperbarui token")
		return
	}
	if tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal memperbarui token")
		return
	}
	access, _ := auth.AccessToken(h.Config, u.ID, u.Email, u.Roles)
	h.setCookie(w, signed)
	httpx.Success(w, 200, map[string]string{"accessToken": access}, "")
}

func (h Handler) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("refreshToken"); err == nil {
		if claims, e := auth.ParseRefresh(h.Config, c.Value); e == nil {
			_, _ = h.DB.Exec(r.Context(), `DELETE FROM "RefreshToken" WHERE "token"=$1`, claims.Token)
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "refreshToken", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: h.Config.Production()})
	httpx.Success(w, 200, nil, "Logout berhasil")
}

func (h Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	c, _ := middleware.Claims(r)
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if decode(r, &in) != nil {
		httpx.Error(w, 400, "Data tidak valid")
		return
	}
	if err := auth.ValidatePassword(in.NewPassword); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	var old string
	err := h.DB.QueryRow(r.Context(), `SELECT "password" FROM "User" WHERE "id"=$1`, c.UserID).Scan(&old)
	if err != nil {
		httpx.Error(w, 404, "User tidak ditemukan")
		return
	}
	if auth.CheckPassword(old, in.CurrentPassword) != nil {
		httpx.Error(w, 400, "Password saat ini salah")
		return
	}
	hashed, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		httpx.Error(w, 500, "Gagal mengubah password")
		return
	}
	_, err = h.DB.Exec(r.Context(), `UPDATE "User" SET "password"=$1,"updatedAt"=NOW() WHERE "id"=$2`, hashed, c.UserID)
	if err != nil {
		httpx.Error(w, 500, "Gagal mengubah password")
		return
	}
	_, _ = h.DB.Exec(r.Context(), `DELETE FROM "RefreshToken" WHERE "userId"=$1`, c.UserID)
	http.SetCookie(w, &http.Cookie{Name: "refreshToken", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: h.Config.Production()})
	httpx.Success(w, 200, nil, "Password berhasil diubah")
}

func (h Handler) invitation(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	var name, email, role, status string
	var expires time.Time
	err := h.DB.QueryRow(r.Context(), `SELECT "name","email","role"::text,"status"::text,"expiresAt" FROM "UserInvitation" WHERE "token"=$1`, token).Scan(&name, &email, &role, &status, &expires)
	if err != nil {
		httpx.Error(w, 404, "Undangan tidak ditemukan")
		return
	}
	if status == "USED" {
		httpx.Error(w, 400, "Undangan sudah digunakan")
		return
	}
	if expires.Before(time.Now()) || status == "EXPIRED" {
		_, _ = h.DB.Exec(r.Context(), `UPDATE "UserInvitation" SET "status"='EXPIRED' WHERE "token"=$1`, token)
		httpx.Error(w, 400, "Undangan sudah expired")
		return
	}
	httpx.Success(w, 200, map[string]string{"name": name, "email": email, "role": role}, "")
}

func (h Handler) setPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if decode(r, &in) != nil || in.Token == "" {
		httpx.Error(w, 400, "Token dan password wajib diisi")
		return
	}
	if err := auth.ValidatePassword(in.Password); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "Gagal membuat akun")
		return
	}
	defer tx.Rollback(r.Context())
	var id, name, email, role string
	var schoolID, groupID, gender *string
	var expires time.Time
	err = tx.QueryRow(r.Context(), `SELECT "id","name","email","role"::text,"schoolId","groupId","gender"::text,"expiresAt" FROM "UserInvitation" WHERE "token"=$1 AND "status"='PENDING' FOR UPDATE`, in.Token).Scan(&id, &name, &email, &role, &schoolID, &groupID, &gender, &expires)
	if err != nil || expires.Before(time.Now()) {
		httpx.Error(w, 400, "Undangan tidak valid atau sudah expired")
		return
	}
	var exists bool
	_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" WHERE "email"=$1)`, email).Scan(&exists)
	if exists {
		httpx.Error(w, 400, "Email sudah terdaftar")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Error(w, 500, "Gagal membuat akun")
		return
	}
	uid := uuid.NewString()
	g := "IKHWAN"
	if gender != nil {
		g = *gender
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO "User" ("id","name","email","password","gender","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())`, uid, name, email, hash, g)
	if err == nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,$3::"Role")`, uuid.NewString(), uid, role)
	}
	if err == nil && schoolID != nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") VALUES ($1,$2,$3)`, uuid.NewString(), uid, *schoolID)
	}
	if err == nil && groupID != nil && role == "ANGGOTA" {
		_, err = tx.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId") VALUES ($1,$2,$3)`, uuid.NewString(), *groupID, uid)
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE "UserInvitation" SET "status"='USED',"usedAt"=NOW() WHERE "id"=$1`, id)
	}
	if err != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal membuat akun")
		return
	}
	httpx.Success(w, 200, nil, "Akun berhasil dibuat, silakan login")
}

func (h Handler) setCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{Name: "refreshToken", Value: value, Path: "/", HttpOnly: true, Secure: h.Config.Production(), SameSite: http.SameSiteLaxMode, MaxAge: int(h.Config.JWTRefreshExpires.Seconds())})
}

var _ = context.Background
var _ = pgx.ErrNoRows
