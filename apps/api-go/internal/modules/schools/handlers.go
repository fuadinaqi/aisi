package schools

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/auth"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
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

func (h Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(h.Config))
	r.Get("/", h.list)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Post("/", h.create)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Put("/{id}", h.update)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Delete("/{id}", h.remove)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Post("/{id}/pj", h.addPJ)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Delete("/{id}/pj/{userId}", h.removePJ)
	r.Get("/{id}/pembina", h.pembina)
	r.Post("/{id}/groups", h.createGroup)
	r.Get("/{id}/stats", h.stats)
	r.Get("/{id}", h.detail)
	return r
}

type pjInput struct {
	Name, Email     string
	Phone           *string
	Gender          string
	Password        *string
	AlsoAsPembina   *bool   `json:"alsoAsPembina"`
	Replace         bool
	ReplaceUserID   *string `json:"replaceUserId"`
}

func alsoAsPembina(v *bool) bool {
	if v == nil {
		return true
	}
	return *v
}
type schoolInput struct {
	Name     string
	City     *string
	IsActive *bool
	PJ       *pjInput `json:"pj"`
}

func decode(r *http.Request, v any) bool { return json.NewDecoder(r.Body).Decode(v) == nil }
func admin(roles []string) bool {
	for _, r := range roles {
		if r == "ADMIN" || r == "SUPERADMIN" {
			return true
		}
	}
	return false
}
func (h Handler) access(r *http.Request, id string) bool {
	c, _ := middleware.Claims(r)
	if admin(c.Roles) {
		return true
	}
	var ok bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, id).Scan(&ok)
	return ok
}
func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	c, _ := middleware.Claims(r)
	q := `SELECT "id","name","city","isActive","createdAt","updatedAt" FROM "School" WHERE "isActive"`
	args := []any{}
	if !admin(c.Roles) {
		q = `SELECT s."id",s."name",s."city",s."isActive",s."createdAt",s."updatedAt" FROM "School" s JOIN "UserSchool" us ON us."schoolId"=s."id" WHERE s."isActive" AND us."userId"=$1`
		args = append(args, c.UserID)
	}
	q += ` ORDER BY "name"`
	rows, e := h.DB.Query(r.Context(), q, args...)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil sekolah")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, n, city string
		var active bool
		var created, updated time.Time
		if rows.Scan(&id, &n, &city, &active, &created, &updated) == nil {
			out = append(out, map[string]any{"id": id, "name": n, "city": city, "isActive": active, "createdAt": created, "updatedAt": updated})
		}
	}
	httpx.Success(w, 200, out, "")
}
func (h Handler) create(w http.ResponseWriter, r *http.Request) {
	var in schoolInput
	if !decode(r, &in) || len(in.Name) < 2 || in.PJ == nil || len(in.PJ.Name) < 2 || in.PJ.Email == "" || !gender(in.PJ.Gender) {
		httpx.Error(w, 400, "Data sekolah atau PJ tidak valid")
		return
	}
	if h.activeEmail(r, in.PJ.Email) {
		httpx.Error(w, 400, "Email PJ sudah terdaftar atau memiliki undangan aktif")
		return
	}
	city := "Depok"
	if in.City != nil && *in.City != "" {
		city = *in.City
	}
	c, _ := middleware.Claims(r)
	tx, e := h.DB.Begin(r.Context())
	if e != nil {
		httpx.Error(w, 500, "Gagal membuat sekolah")
		return
	}
	defer tx.Rollback(r.Context())
	sid := uuid.NewString()
	_, e = tx.Exec(r.Context(), `INSERT INTO "School" ("id","name","city","updatedAt") VALUES ($1,$2,$3,NOW())`, sid, in.Name, city)
	if e != nil {
		httpx.Error(w, 400, "Nama sekolah sudah terdaftar")
		return
	}
	mode := "invite"
	data := map[string]any{"school": map[string]any{"id": sid, "name": in.Name, "city": city}}
	if in.PJ.Password != nil {
		if err := auth.ValidatePassword(*in.PJ.Password); err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		uid := uuid.NewString()
		hash, he := auth.HashPassword(*in.PJ.Password)
		if he != nil {
			httpx.Error(w, 500, "Gagal membuat sekolah")
			return
		}
		_, e = tx.Exec(r.Context(), `INSERT INTO "User" ("id","name","email","phone","password","gender","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"Gender",NOW())`, uid, in.PJ.Name, in.PJ.Email, in.PJ.Phone, hash, in.PJ.Gender)
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'PJ_SEKOLAH')`, uuid.NewString(), uid)
		}
		if e == nil && alsoAsPembina(in.PJ.AlsoAsPembina) {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'PEMBINA')`, uuid.NewString(), uid)
		}
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") VALUES ($1,$2,$3)`, uuid.NewString(), uid, sid)
		}
		mode = "direct"
		data["pjUser"] = map[string]any{"id": uid, "name": in.PJ.Name, "email": in.PJ.Email}
	} else {
		token := uuid.NewString()
		iid := uuid.NewString()
		expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserInvitation" ("id","name","email","role","alsoAsPembina","gender","schoolId","token","invitedById","expiresAt") VALUES ($1,$2,$3,'PJ_SEKOLAH',$4,$5::"Gender",$6,$7,$8,$9)`, iid, in.PJ.Name, in.PJ.Email, alsoAsPembina(in.PJ.AlsoAsPembina), in.PJ.Gender, sid, token, c.UserID, expires)
		data["invitation"] = map[string]any{"id": iid, "email": in.PJ.Email, "status": "PENDING"}
		data["_inviteToken"] = token
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal membuat sekolah")
		return
	}
	if mode == "invite" {
		tok := data["_inviteToken"].(string)
		delete(data, "_inviteToken")
		if e = email.New(h.Config).SendInvitation(r.Context(), in.PJ.Email, in.PJ.Name, h.Config.AppURL+"/set-password?token="+tok); e != nil {
			httpx.Error(w, 502, "Sekolah dibuat, namun email gagal dikirim")
			return
		}
	}
	data["mode"] = mode
	msg := "Sekolah berhasil dibuat. Undangan PJ Sekolah telah dikirim."
	if mode == "direct" {
		msg = "Sekolah dan akun PJ Sekolah berhasil dibuat"
	}
	httpx.Success(w, 201, data, msg)
}
func (h Handler) update(w http.ResponseWriter, r *http.Request) {
	var in schoolInput
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	var id, name, city string
	var active bool
	e := h.DB.QueryRow(r.Context(), `UPDATE "School" SET "name"=COALESCE(NULLIF($1,''),"name"),"city"=COALESCE(NULLIF($2,''),"city"),"isActive"=COALESCE($3,"isActive"),"updatedAt"=NOW() WHERE "id"=$4 RETURNING "id","name","city","isActive"`, in.Name, in.City, in.IsActive, chi.URLParam(r, "id")).Scan(&id, &name, &city, &active)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Sekolah tidak ditemukan")
		return
	}
	if e != nil {
		httpx.Error(w, 400, "Gagal memperbarui sekolah")
		return
	}
	httpx.Success(w, 200, map[string]any{"id": id, "name": name, "city": city, "isActive": active}, "Sekolah berhasil diperbarui")
}
func (h Handler) remove(w http.ResponseWriter, r *http.Request) {
	tag, e := h.DB.Exec(r.Context(), `UPDATE "School" SET "isActive"=false,"updatedAt"=NOW() WHERE "id"=$1`, chi.URLParam(r, "id"))
	if e != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "Sekolah tidak ditemukan")
		return
	}
	httpx.Success(w, 200, nil, "Sekolah dinonaktifkan")
}
func (h Handler) addPJ(w http.ResponseWriter, r *http.Request) {
	var in pjInput
	if !decode(r, &in) || len(in.Name) < 2 || in.Email == "" || !gender(in.Gender) {
		httpx.Error(w, 400, "Data PJ tidak valid")
		return
	}
	sid := chi.URLParam(r, "id")
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "School" WHERE "id"=$1 AND "isActive")`, sid).Scan(&exists)
	if !exists {
		httpx.Error(w, 404, "Sekolah tidak ditemukan")
		return
	}
	if h.activeEmail(r, in.Email) {
		httpx.Error(w, 400, "Email sudah terdaftar atau memiliki undangan aktif")
		return
	}
	tx, e := h.DB.Begin(r.Context())
	if e != nil {
		httpx.Error(w, 500, "Gagal membuat PJ")
		return
	}
	defer tx.Rollback(r.Context())
	if in.Replace {
		if in.ReplaceUserID != nil {
			_, e = tx.Exec(r.Context(), `DELETE FROM "UserSchool" WHERE "schoolId"=$1 AND "userId"=$2`, sid, *in.ReplaceUserID)
		} else {
			_, e = tx.Exec(r.Context(), `DELETE FROM "UserSchool" us USING "UserRole" ur WHERE us."userId"=ur."userId" AND us."schoolId"=$1 AND ur."role"='PJ_SEKOLAH'`, sid)
		}
		if e != nil {
			httpx.Error(w, 500, "Gagal mengganti PJ")
			return
		}
	}
	c, _ := middleware.Claims(r)
	mode := "invite"
	data := map[string]any{}
	if in.Password != nil {
		if err := auth.ValidatePassword(*in.Password); err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		uid := uuid.NewString()
		hash, he := auth.HashPassword(*in.Password)
		if he != nil {
			httpx.Error(w, 500, "Gagal membuat PJ")
			return
		}
		_, e = tx.Exec(r.Context(), `INSERT INTO "User" ("id","name","email","phone","password","gender","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"Gender",NOW())`, uid, in.Name, in.Email, in.Phone, hash, in.Gender)
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'PJ_SEKOLAH')`, uuid.NewString(), uid)
		}
		if e == nil && alsoAsPembina(in.AlsoAsPembina) {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'PEMBINA')`, uuid.NewString(), uid)
		}
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") VALUES ($1,$2,$3)`, uuid.NewString(), uid, sid)
		}
		mode = "direct"
		data["pjUser"] = map[string]string{"id": uid, "name": in.Name, "email": in.Email}
	} else {
		token, iid := uuid.NewString(), uuid.NewString()
		expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserInvitation" ("id","name","email","role","alsoAsPembina","gender","schoolId","token","invitedById","expiresAt") VALUES ($1,$2,$3,'PJ_SEKOLAH',$4,$5::"Gender",$6,$7,$8,$9)`, iid, in.Name, in.Email, alsoAsPembina(in.AlsoAsPembina), in.Gender, sid, token, c.UserID, expires)
		data["invitation"] = map[string]string{"id": iid, "email": in.Email}
		data["_inviteToken"] = token
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal membuat PJ")
		return
	}
	if mode == "invite" {
		tok := data["_inviteToken"].(string)
		delete(data, "_inviteToken")
		if e = email.New(h.Config).SendInvitation(r.Context(), in.Email, in.Name, h.Config.AppURL+"/set-password?token="+tok); e != nil {
			httpx.Error(w, 502, "Undangan dibuat, namun email gagal dikirim")
			return
		}
	}
	data["mode"] = mode
	httpx.Success(w, 201, data, "PJ Sekolah berhasil ditambahkan")
}
func (h Handler) removePJ(w http.ResponseWriter, r *http.Request) {
	sid, uid := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	var n int
	e := h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "UserSchool" us JOIN "UserRole" ur ON ur."userId"=us."userId" WHERE us."schoolId"=$1 AND ur."role"='PJ_SEKOLAH'`, sid).Scan(&n)
	if e != nil || n <= 1 {
		httpx.Error(w, 400, "Sekolah harus memiliki minimal 1 PJ Sekolah")
		return
	}
	tag, e := h.DB.Exec(r.Context(), `DELETE FROM "UserSchool" WHERE "schoolId"=$1 AND "userId"=$2`, sid, uid)
	if e != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "PJ Sekolah tidak ditemukan di sekolah ini")
		return
	}
	httpx.Success(w, 200, nil, "PJ Sekolah berhasil dihapus dari sekolah")
}
func (h Handler) pembina(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	g := r.URL.Query().Get("gender")
	// Semua pembina (boleh lintas sekolah); tandai yang sudah terkait sekolah ini.
	rows, e := h.DB.Query(r.Context(), `
		SELECT u."id",u."name",u."email",u."gender"::text,u."phone",
			EXISTS(
				SELECT 1 FROM "UserSchool" us WHERE us."userId"=u."id" AND us."schoolId"=$1
			) OR EXISTS(
				SELECT 1 FROM "Group" gr WHERE gr."pembinaId"=u."id" AND gr."schoolId"=$1 AND gr."isActive"
			) AS "inSchool"
		FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u."id"
		WHERE u."isActive" AND ur."role"='PEMBINA'
		  AND ($2='' OR u."gender"::text=$2)
		ORDER BY "inSchool" DESC, u."name"`, sid, g)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil pembina")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, n, mail, gender string
		var phone *string
		var inSchool bool
		if rows.Scan(&id, &n, &mail, &gender, &phone, &inSchool) == nil {
			out = append(out, map[string]any{"id": id, "name": n, "email": mail, "gender": gender, "phone": phone, "inSchool": inSchool})
		}
	}
	httpx.Success(w, 200, out, "")
}
func (h Handler) createGroup(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in struct {
		Name      string `json:"name"`
		Level     string `json:"level"`
		Gender    string `json:"gender"`
		PembinaID string `json:"pembinaId"`
		Pembina   *struct {
			Name     string  `json:"name"`
			Email    string  `json:"email"`
			Phone    *string `json:"phone"`
			Gender   string  `json:"gender"`
			Password *string `json:"password"`
		} `json:"pembina"`
	}
	if !decode(r, &in) || len(in.Name) < 2 || (in.Level != "LEVEL_1" && in.Level != "LEVEL_2") || !gender(in.Gender) || (in.PembinaID == "" && in.Pembina == nil) {
		httpx.Error(w, 400, "Data kelompok tidak valid")
		return
	}
	if in.PembinaID != "" && in.Pembina != nil {
		httpx.Error(w, 400, "Pilih pembina existing atau pembina baru, bukan keduanya")
		return
	}

	if in.PembinaID != "" {
		var ok bool
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" u JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 AND u."isActive" AND ur."role"='PEMBINA')`, in.PembinaID).Scan(&ok)
		if !ok {
			httpx.Error(w, 400, "Pembina tidak ditemukan")
			return
		}
		tx, e := h.DB.Begin(r.Context())
		if e != nil {
			httpx.Error(w, 500, "Gagal membuat kelompok")
			return
		}
		defer tx.Rollback(r.Context())
		id := uuid.NewString()
		_, e = tx.Exec(r.Context(), `INSERT INTO "Group" ("id","name","level","gender","schoolId","pembinaId","updatedAt") VALUES ($1,$2,$3::"GroupLevel",$4::"Gender",$5,$6,NOW())`, id, in.Name, in.Level, in.Gender, sid, in.PembinaID)
		if e == nil {
			// Tautkan pembina ke sekolah ini (boleh sudah punya sekolah lain).
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "UserSchool" WHERE "userId"=$2 AND "schoolId"=$3)`, uuid.NewString(), in.PembinaID, sid)
		}
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal membuat kelompok")
			return
		}
		httpx.Success(w, 201, map[string]any{"group": map[string]string{"id": id, "name": in.Name}, "mode": "direct"}, "Kelompok berhasil dibuat")
		return
	}

	p := in.Pembina
	if len(p.Name) < 2 || p.Email == "" {
		httpx.Error(w, 400, "Data pembina tidak valid")
		return
	}
	pgender := p.Gender
	if pgender == "" {
		pgender = in.Gender
	}
	if !gender(pgender) {
		httpx.Error(w, 400, "Jenis kelamin pembina tidak valid")
		return
	}
	// Email sudah pembina aktif: tautkan ke sekolah + buat kelompok (multi-sekolah).
	// Gender pembina boleh beda dari jenis kelompok.
	var existingPembinaID string
	_ = h.DB.QueryRow(r.Context(), `
		SELECT u."id" FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u."id"
		WHERE u."email"=$1 AND u."isActive" AND ur."role"='PEMBINA'`,
		p.Email).Scan(&existingPembinaID)
	if existingPembinaID != "" {
		tx, e := h.DB.Begin(r.Context())
		if e != nil {
			httpx.Error(w, 500, "Gagal membuat kelompok")
			return
		}
		defer tx.Rollback(r.Context())
		gid := uuid.NewString()
		_, e = tx.Exec(r.Context(), `INSERT INTO "Group" ("id","name","level","gender","schoolId","pembinaId","updatedAt") VALUES ($1,$2,$3::"GroupLevel",$4::"Gender",$5,$6,NOW())`, gid, in.Name, in.Level, in.Gender, sid, existingPembinaID)
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "UserSchool" WHERE "userId"=$2 AND "schoolId"=$3)`, uuid.NewString(), existingPembinaID, sid)
		}
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal membuat kelompok")
			return
		}
		httpx.Success(w, 201, map[string]any{
			"mode":    "direct",
			"group":   map[string]string{"id": gid, "name": in.Name},
			"pembina": map[string]any{"id": existingPembinaID, "email": p.Email},
		}, "Kelompok dibuat; pembina existing ditautkan ke sekolah ini")
		return
	}
	if h.activeEmail(r, p.Email) {
		httpx.Error(w, 400, "Email pembina sudah terdaftar atau memiliki undangan aktif")
		return
	}

	hasPassword := p.Password != nil && *p.Password != ""
	c, _ := middleware.Claims(r)
	tx, e := h.DB.Begin(r.Context())
	if e != nil {
		httpx.Error(w, 500, "Gagal membuat kelompok")
		return
	}
	defer tx.Rollback(r.Context())

	if !hasPassword {
		token := uuid.NewString()
		iid := uuid.NewString()
		expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserInvitation" ("id","name","email","role","alsoAsPembina","gender","schoolId","token","invitedById","expiresAt") VALUES ($1,$2,$3,'PEMBINA',false,$4::"Gender",$5,$6,$7,$8)`, iid, p.Name, p.Email, pgender, sid, token, c.UserID, expires)
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal mengundang pembina")
			return
		}
		if e = email.New(h.Config).SendInvitation(r.Context(), p.Email, p.Name, h.Config.AppURL+"/set-password?token="+token); e != nil {
			httpx.Error(w, 502, "Undangan dibuat, namun email gagal dikirim")
			return
		}
		httpx.Success(w, 201, map[string]any{
			"mode": "invite",
			"invitation": map[string]any{"id": iid, "email": p.Email, "status": "PENDING"},
		}, "Undangan pembina berhasil dikirim")
		return
	}

	if err := auth.ValidatePassword(*p.Password); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	uid := uuid.NewString()
	hash, he := auth.HashPassword(*p.Password)
	if he != nil {
		httpx.Error(w, 500, "Gagal membuat pembina")
		return
	}
	_, e = tx.Exec(r.Context(), `INSERT INTO "User" ("id","name","email","phone","password","gender","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"Gender",NOW())`, uid, p.Name, p.Email, p.Phone, hash, pgender)
	if e == nil {
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'PEMBINA')`, uuid.NewString(), uid)
	}
	if e == nil {
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") VALUES ($1,$2,$3)`, uuid.NewString(), uid, sid)
	}
	gid := uuid.NewString()
	if e == nil {
		_, e = tx.Exec(r.Context(), `INSERT INTO "Group" ("id","name","level","gender","schoolId","pembinaId","updatedAt") VALUES ($1,$2,$3::"GroupLevel",$4::"Gender",$5,$6,NOW())`, gid, in.Name, in.Level, in.Gender, sid, uid)
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal membuat kelompok")
		return
	}
	httpx.Success(w, 201, map[string]any{
		"mode":    "direct",
		"group":   map[string]string{"id": gid, "name": in.Name},
		"pembina": map[string]any{"id": uid, "name": p.Name, "email": p.Email},
	}, "Kelompok dan akun pembina berhasil dibuat")
}
func (h Handler) detail(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	ctx := r.Context()
	var id, n, city string
	var active bool
	var created, updated time.Time
	e := h.DB.QueryRow(ctx, `SELECT "id","name","city","isActive","createdAt","updatedAt" FROM "School" WHERE "id"=$1 AND "isActive"=true`, sid).Scan(&id, &n, &city, &active, &created, &updated)
	if e != nil {
		httpx.Error(w, 404, "Sekolah tidak ditemukan")
		return
	}

	pjUsers := make([]map[string]any, 0)
	pjRows, err := h.DB.Query(ctx, `
		SELECT u."id", u."name", u."email", u."phone"
		FROM "User" u
		INNER JOIN "UserSchool" us ON us."userId" = u."id"
		INNER JOIN "UserRole" ur ON ur."userId" = u."id"
		WHERE us."schoolId" = $1
		  AND u."isActive" = true
		  AND ur."role" = 'PJ_SEKOLAH'::"Role"
		ORDER BY u."name"`, sid)
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat PJ sekolah")
		return
	}
	for pjRows.Next() {
		var uid, name, email string
		var phone *string
		if err := pjRows.Scan(&uid, &name, &email, &phone); err != nil {
			pjRows.Close()
			httpx.Error(w, 500, "Gagal membaca PJ")
			return
		}
		pjUsers = append(pjUsers, map[string]any{"id": uid, "name": name, "email": email, "phone": phone})
	}
	pjRows.Close()
	if err := pjRows.Err(); err != nil {
		httpx.Error(w, 500, "Gagal memuat PJ")
		return
	}

	type gRow struct {
		id, name, level, gender, pembinaID, pembinaName, pembinaEmail string
		createdAt                                                     time.Time
		memberCount                                                   int64
	}
	groupsRaw := make([]gRow, 0)
	gRows, err := h.DB.Query(ctx, `
		SELECT g."id", g."name", g."level"::text, g."gender"::text, g."createdAt",
		       u."id", u."name", COALESCE(u."email", ''),
		       COALESCE((SELECT count(*) FROM "GroupMember" gm WHERE gm."groupId"=g."id" AND gm."isActive"=true), 0)
		FROM "Group" g
		INNER JOIN "User" u ON u."id" = g."pembinaId"
		WHERE g."schoolId" = $1 AND g."isActive" = true
		ORDER BY g."name"`, sid)
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat kelompok")
		return
	}
	for gRows.Next() {
		var gr gRow
		if err := gRows.Scan(&gr.id, &gr.name, &gr.level, &gr.gender, &gr.createdAt, &gr.pembinaID, &gr.pembinaName, &gr.pembinaEmail, &gr.memberCount); err != nil {
			gRows.Close()
			httpx.Error(w, 500, "Gagal membaca kelompok")
			return
		}
		groupsRaw = append(groupsRaw, gr)
	}
	gRows.Close()
	if err := gRows.Err(); err != nil {
		httpx.Error(w, 500, "Gagal memuat kelompok")
		return
	}

	membersByGroup := map[string][]struct {
		userID   string
		joinedAt time.Time
	}{}
	mRows, err := h.DB.Query(ctx, `
		SELECT gm."groupId", gm."userId", gm."joinedAt"
		FROM "GroupMember" gm
		INNER JOIN "Group" g ON g."id"=gm."groupId"
		WHERE g."schoolId"=$1 AND g."isActive"=true AND gm."isActive"=true`, sid)
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat anggota kelompok")
		return
	}
	for mRows.Next() {
		var gid, uid string
		var joined time.Time
		if err := mRows.Scan(&gid, &uid, &joined); err != nil {
			mRows.Close()
			httpx.Error(w, 500, "Gagal membaca anggota")
			return
		}
		membersByGroup[gid] = append(membersByGroup[gid], struct {
			userID   string
			joinedAt time.Time
		}{uid, joined})
	}
	mRows.Close()

	type evalAtt struct {
		userID string
		status string
	}
	evalsByGroup := map[string][]struct {
		weekDate time.Time
		atts     []evalAtt
	}{}
	eRows, err := h.DB.Query(ctx, `
		SELECT e."id", e."groupId", e."weekDate"
		FROM "WeeklyEvaluation" e
		INNER JOIN "Group" g ON g."id"=e."groupId"
		WHERE g."schoolId"=$1 AND g."isActive"=true AND e."isSubmitted"=true`, sid)
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat evaluasi")
		return
	}
	type evMeta struct {
		id, groupID string
		weekDate    time.Time
	}
	evs := make([]evMeta, 0)
	for eRows.Next() {
		var em evMeta
		if err := eRows.Scan(&em.id, &em.groupID, &em.weekDate); err != nil {
			eRows.Close()
			httpx.Error(w, 500, "Gagal membaca evaluasi")
			return
		}
		evs = append(evs, em)
	}
	eRows.Close()
	for _, em := range evs {
		aRows, aerr := h.DB.Query(ctx, `SELECT "userId", "status"::text FROM "EvaluationAttendance" WHERE "evaluationId"=$1`, em.id)
		atts := make([]evalAtt, 0)
		if aerr == nil {
			for aRows.Next() {
				var uid, st string
				if aRows.Scan(&uid, &st) == nil {
					atts = append(atts, evalAtt{uid, st})
				}
			}
			aRows.Close()
		}
		evalsByGroup[em.groupID] = append(evalsByGroup[em.groupID], struct {
			weekDate time.Time
			atts     []evalAtt
		}{em.weekDate, atts})
	}

	monday := func(t time.Time) time.Time {
		t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		wd := int(t.Weekday())
		if wd == 0 {
			wd = 7
		}
		return t.AddDate(0, 0, -(wd - 1))
	}

	groupsOut := make([]map[string]any, 0, len(groupsRaw))
	totalAnggota := 0
	for _, gr := range groupsRaw {
		mc := int(gr.memberCount)
		totalAnggota += mc
		members := membersByGroup[gr.id]
		evals := evalsByGroup[gr.id]
		groupMonday := monday(gr.createdAt)
		totalPekan, totalHadir, totalSlots := 0, 0, 0
		for _, ev := range evals {
			if ev.weekDate.Before(groupMonday) {
				continue
			}
			totalPekan++
			eligible := 0
			hadir := 0
			for _, m := range members {
				if !monday(m.joinedAt).After(ev.weekDate) {
					eligible++
				}
			}
			totalSlots += eligible
			for _, a := range ev.atts {
				if a.status != "HADIR" {
					continue
				}
				for _, m := range members {
					if m.userID == a.userID && !monday(m.joinedAt).After(ev.weekDate) {
						hadir++
						break
					}
				}
			}
			totalHadir += hadir
		}
		var rate any
		if totalSlots > 0 {
			rate = int(float64(totalHadir) / float64(totalSlots) * 100)
		} else {
			rate = nil
		}
		groupsOut = append(groupsOut, map[string]any{
			"id":     gr.id,
			"name":   gr.name,
			"level":  gr.level,
			"gender": gr.gender,
			"pembina": map[string]any{
				"id": gr.pembinaID, "name": gr.pembinaName, "email": gr.pembinaEmail,
			},
			"_count":         map[string]int{"members": mc},
			"attendanceRate": rate,
			"totalHadir":     totalHadir,
			"totalPekan":     totalPekan,
			"totalSlots":     totalSlots,
		})
	}

	httpx.Success(w, 200, map[string]any{
		"id": id, "name": n, "city": city, "isActive": active,
		"createdAt": created, "updatedAt": updated,
		"pjUsers": pjUsers, "groups": groupsOut,
		"totalGroups": len(groupsOut), "totalAnggota": totalAnggota,
	}, "")
}
func (h Handler) stats(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var groups, members, evals, total int
	_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "Group" WHERE "schoolId"=$1 AND "isActive"`, sid).Scan(&groups)
	_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE g."schoolId"=$1 AND g."isActive" AND gm."isActive"`, sid).Scan(&members)
	_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE g."schoolId"=$1 AND e."isSubmitted"`, sid).Scan(&total)
	_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE g."schoolId"=$1 AND e."isSubmitted" AND e."weekDate">=date_trunc('week',CURRENT_DATE)`, sid).Scan(&evals)
	rate := 0
	if groups > 0 {
		rate = evals * 100 / groups
	}
	httpx.Success(w, 200, map[string]int{"totalGroups": groups, "totalAnggota": members, "evaluationsThisWeek": evals, "totalEvaluations": total, "submissionRate": rate}, "")
}
func (h Handler) activeEmail(r *http.Request, mail string) bool {
	var v bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" WHERE "email"=$1 AND "isActive") OR EXISTS(SELECT 1 FROM "UserInvitation" WHERE "email"=$1 AND "status"='PENDING' AND "expiresAt">NOW())`, mail).Scan(&v)
	return v
}
func gender(v string) bool { return v == "IKHWAN" || v == "AKHWAT" }
