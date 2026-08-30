package groups

import (
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/auth"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/email"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/validate"
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
	r.With(middleware.RequireRole("PJ_SEKOLAH", "ADMIN", "SUPERADMIN")).Post("/", h.create)
	r.Get("/{id}", h.detail)
	r.Put("/{id}", h.update)
	r.With(middleware.RequireRole("PJ_SEKOLAH", "ADMIN", "SUPERADMIN")).Delete("/{id}", h.remove)
	r.Get("/{id}/member-candidates", h.memberCandidates)
	r.Get("/{id}/members", h.members)
	r.Post("/{id}/members", h.addMember)
	r.Get("/{id}/members/{userId}", h.member)
	r.Put("/{id}/members/{userId}", h.updateMember)
	r.Delete("/{id}/members/{userId}", h.removeMember)
	return r
}
func decode(r *http.Request, v any) bool { return json.NewDecoder(r.Body).Decode(v) == nil }
func admin(roles []string) bool {
	for _, x := range roles {
		if x == "ADMIN" || x == "SUPERADMIN" {
			return true
		}
	}
	return false
}
func (h Handler) groupAccess(r *http.Request, id string, write bool) bool {
	c, _ := middleware.Claims(r)
	if admin(c.Roles) {
		return true
	}
	var owner, school string
	e := h.DB.QueryRow(r.Context(), `SELECT "pembinaId","schoolId" FROM "Group" WHERE "id"=$1`, id).Scan(&owner, &school)
	if e != nil {
		return false
	}
	if owner == c.UserID {
		return true
	}
	if has(c.Roles, "PJ_SEKOLAH") {
		var ok bool
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, school).Scan(&ok)
		return ok
	}
	if write {
		return false
	}
	if has(c.Roles, "ANGGOTA") {
		var ok bool
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "GroupMember" WHERE "groupId"=$1 AND "userId"=$2 AND "isActive")`, id, c.UserID).Scan(&ok)
		return ok
	}
	return false
}
func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	c, _ := middleware.Claims(r)
	q := `SELECT g."id",g."name",g."level"::text,g."gender"::text,g."schoolId",s."name",g."pembinaId",u."name",g."isActive",count(gm."id") FILTER(WHERE gm."isActive") FROM "Group" g JOIN "School" s ON s."id"=g."schoolId" JOIN "User" u ON u."id"=g."pembinaId" LEFT JOIN "GroupMember" gm ON gm."groupId"=g."id" WHERE g."isActive"`
	args := []any{}
	if !admin(c.Roles) {
		hasPembina := false
		hasPJ := false
		hasAnggota := false
		for _, x := range c.Roles {
			hasPembina = hasPembina || x == "PEMBINA"
			hasPJ = hasPJ || x == "PJ_SEKOLAH"
			hasAnggota = hasAnggota || x == "ANGGOTA"
		}
		if hasPembina {
			q += ` AND g."pembinaId"=$1`
			args = append(args, c.UserID)
		} else if hasPJ {
			q += ` AND EXISTS(SELECT 1 FROM "UserSchool" us WHERE us."userId"=$1 AND us."schoolId"=g."schoolId")`
			args = append(args, c.UserID)
		} else if hasAnggota {
			q += ` AND EXISTS(SELECT 1 FROM "GroupMember" gm2 WHERE gm2."groupId"=g."id" AND gm2."userId"=$1 AND gm2."isActive")`
			args = append(args, c.UserID)
		} else {
			httpx.Success(w, 200, []map[string]any{}, "")
			return
		}
	}
	q += ` GROUP BY g."id",s."id",u."id" ORDER BY g."name"`
	rows, e := h.DB.Query(r.Context(), q, args...)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil kelompok")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, n, l, g, sid, sn, pid, pn string
		var active bool
		var count int
		if rows.Scan(&id, &n, &l, &g, &sid, &sn, &pid, &pn, &active, &count) == nil {
			out = append(out, map[string]any{"id": id, "name": n, "level": l, "gender": g, "schoolId": sid, "school": map[string]string{"id": sid, "name": sn}, "pembinaId": pid, "pembina": map[string]string{"id": pid, "name": pn}, "isActive": active, "_count": map[string]int{"members": count}})
		}
	}
	httpx.Success(w, 200, out, "")
}

type input struct {
	Name      string `json:"name"`
	Level     string `json:"level"`
	Gender    string `json:"gender"`
	SchoolID  string `json:"schoolId"`
	PembinaID string `json:"pembinaId"`
	IsActive  *bool  `json:"isActive"`
}

func (h Handler) create(w http.ResponseWriter, r *http.Request) {
	var in input
	if !decode(r, &in) || len(in.Name) < 2 || !level(in.Level) || !gender(in.Gender) || in.SchoolID == "" || in.PembinaID == "" {
		httpx.Error(w, 400, "Data kelompok tidak valid")
		return
	}
	c, _ := middleware.Claims(r)
	if !admin(c.Roles) {
		var ok bool
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, in.SchoolID).Scan(&ok)
		if !ok {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
	}
	var pembinaOK bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" u JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 AND u."isActive" AND ur."role"='PEMBINA')`, in.PembinaID).Scan(&pembinaOK)
	if !pembinaOK {
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
	_, e = tx.Exec(r.Context(), `INSERT INTO "Group" ("id","name","level","gender","schoolId","pembinaId","updatedAt") VALUES ($1,$2,$3::"GroupLevel",$4::"Gender",$5,$6,NOW())`, id, in.Name, in.Level, in.Gender, in.SchoolID, in.PembinaID)
	if e == nil {
		_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "UserSchool" WHERE "userId"=$2 AND "schoolId"=$3)`, uuid.NewString(), in.PembinaID, in.SchoolID)
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 400, "Gagal membuat kelompok")
		return
	}
	httpx.Success(w, 201, map[string]any{"id": id, "name": in.Name, "level": in.Level, "gender": in.Gender, "schoolId": in.SchoolID, "pembinaId": in.PembinaID}, "Kelompok berhasil dibuat")
}
func (h Handler) detail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, false) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var n, l, g, sid, pid string
	var active bool
	var created time.Time
	e := h.DB.QueryRow(r.Context(), `SELECT "name","level"::text,"gender"::text,"schoolId","pembinaId","isActive","createdAt" FROM "Group" WHERE "id"=$1`, id).Scan(&n, &l, &g, &sid, &pid, &active, &created)
	if e != nil {
		httpx.Error(w, 404, "Kelompok tidak ditemukan")
		return
	}
	var schoolName string
	_ = h.DB.QueryRow(r.Context(), `SELECT "name" FROM "School" WHERE "id"=$1`, sid).Scan(&schoolName)
	var pembinaName, pembinaEmail string
	var pembinaPhone *string
	var pembinaGender string
	_ = h.DB.QueryRow(r.Context(), `SELECT "name","email","phone","gender"::text FROM "User" WHERE "id"=$1`, pid).Scan(&pembinaName, &pembinaEmail, &pembinaPhone, &pembinaGender)
	ms := h.memberRows(r, id)
	httpx.Success(w, 200, map[string]any{
		"id": id, "name": n, "level": l, "gender": g, "schoolId": sid, "pembinaId": pid,
		"isActive": active, "createdAt": created,
		"school":  map[string]any{"id": sid, "name": schoolName},
		"pembina": map[string]any{"id": pid, "name": pembinaName, "email": pembinaEmail, "phone": pembinaPhone, "gender": pembinaGender},
		"members": ms,
		"_count":  map[string]int{"members": len(ms)},
	}, "")
}
func (h Handler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in input
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	if in.Gender != "" && !gender(in.Gender) {
		httpx.Error(w, 400, "Jenis kelamin tidak valid")
		return
	}
	if in.Level != "" && !level(in.Level) {
		httpx.Error(w, 400, "Level tidak valid")
		return
	}
	var oldGender string
	var oldPembina string
	e := h.DB.QueryRow(r.Context(), `SELECT "gender"::text,"pembinaId" FROM "Group" WHERE "id"=$1`, id).Scan(&oldGender, &oldPembina)
	if e != nil {
		httpx.Error(w, 404, "Kelompok tidak ditemukan")
		return
	}
	if in.Gender != "" && in.Gender != oldGender {
		var count int
		_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "GroupMember" WHERE "groupId"=$1 AND "isActive"`, id).Scan(&count)
		if count > 0 {
			httpx.Error(w, 400, "Jenis kelompok tidak dapat diubah karena masih ada anggota")
			return
		}
	}
	if in.PembinaID != "" && in.PembinaID != oldPembina {
		c, _ := middleware.Claims(r)
		if !admin(c.Roles) && !has(c.Roles, "PJ_SEKOLAH") {
			httpx.Error(w, 403, "Hanya PJ Sekolah atau Admin yang dapat mengganti pembina")
			return
		}
		var pembinaOK bool
		_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" u JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 AND u."isActive" AND ur."role"='PEMBINA')`, in.PembinaID).Scan(&pembinaOK)
		if !pembinaOK {
			httpx.Error(w, 400, "Pembina tidak ditemukan")
			return
		}
	}
	tx, e := h.DB.Begin(r.Context())
	if e != nil {
		httpx.Error(w, 500, "Gagal memperbarui kelompok")
		return
	}
	defer tx.Rollback(r.Context())
	_, e = tx.Exec(r.Context(), `UPDATE "Group" SET "name"=COALESCE(NULLIF($1,''),"name"),"level"=COALESCE(NULLIF($2,'')::"GroupLevel","level"),"gender"=COALESCE(NULLIF($3,'')::"Gender","gender"),"pembinaId"=COALESCE(NULLIF($4,''),"pembinaId"),"isActive"=COALESCE($5,"isActive"),"updatedAt"=NOW() WHERE "id"=$6`, in.Name, in.Level, in.Gender, in.PembinaID, in.IsActive, id)
	if e == nil && in.PembinaID != "" {
		var schoolID string
		_ = tx.QueryRow(r.Context(), `SELECT "schoolId" FROM "Group" WHERE "id"=$1`, id).Scan(&schoolID)
		if schoolID != "" {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserSchool" ("id","userId","schoolId") SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM "UserSchool" WHERE "userId"=$2 AND "schoolId"=$3)`, uuid.NewString(), in.PembinaID, schoolID)
		}
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 400, "Gagal memperbarui kelompok")
		return
	}
	httpx.Success(w, 200, map[string]string{"id": id}, "Kelompok berhasil diperbarui")
}
func (h Handler) remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	tag, e := h.DB.Exec(r.Context(), `UPDATE "Group" SET "isActive"=false,"updatedAt"=NOW() WHERE "id"=$1`, id)
	if e != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "Kelompok tidak ditemukan")
		return
	}
	httpx.Success(w, 200, nil, "Kelompok dinonaktifkan")
}
func (h Handler) members(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, false) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	httpx.Success(w, 200, h.memberRows(r, id), "")
}
func (h Handler) memberRows(r *http.Request, id string) []map[string]any {
	rows, e := h.DB.Query(r.Context(), `SELECT gm."id",gm."userId",gm."joinedAt",u."name",u."email",u."phone",u."gender"::text,u."totalPoints" FROM "GroupMember" gm JOIN "User" u ON u."id"=gm."userId" WHERE gm."groupId"=$1 AND gm."isActive"`, id)
	if e != nil {
		return []map[string]any{}
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var mid, uid, n, mail, g string
		var phone *string
		var joined time.Time
		var points int
		if rows.Scan(&mid, &uid, &joined, &n, &mail, &phone, &g, &points) == nil {
			out = append(out, map[string]any{"id": mid, "userId": uid, "joinedAt": joined, "user": map[string]any{"id": uid, "name": n, "email": mail, "phone": phone, "gender": g, "totalPoints": points}})
		}
	}
	return out
}
func optionalPhone(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func (h Handler) groupGender(r *http.Request, id string) (gender string, ok bool) {
	var active bool
	if h.DB.QueryRow(r.Context(), `SELECT "gender"::text,"isActive" FROM "Group" WHERE "id"=$1`, id).Scan(&gender, &active) != nil || !active {
		return "", false
	}
	return gender, true
}

func (h Handler) memberCandidates(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	gender, ok := h.groupGender(r, id)
	if !ok {
		httpx.Error(w, 404, "Kelompok tidak ditemukan")
		return
	}
	rows, e := h.DB.Query(r.Context(), `
		SELECT u."id", u."name", u."email", u."phone", u."gender"::text,
			(
				SELECT g."name" FROM "GroupMember" gm
				JOIN "Group" g ON g."id"=gm."groupId"
				WHERE gm."userId"=u."id"
				ORDER BY gm."joinedAt" DESC
				LIMIT 1
			)
		FROM "User" u
		JOIN "UserRole" ur ON ur."userId"=u."id" AND ur."role"='ANGGOTA'
		WHERE u."isActive"
		  AND u."gender"::text=$1
		  AND NOT EXISTS (
			SELECT 1 FROM "GroupMember" gm
			JOIN "Group" g ON g."id"=gm."groupId"
			WHERE gm."userId"=u."id" AND gm."isActive" AND g."isActive"
		  )
		ORDER BY u."name"`, gender)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil calon anggota")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var uid, name, mail, ug string
		var phone, lastGroup *string
		if rows.Scan(&uid, &name, &mail, &phone, &ug, &lastGroup) == nil {
			out = append(out, map[string]any{
				"id": uid, "name": name, "email": mail, "phone": phone, "gender": ug,
				"lastGroupName": lastGroup,
			})
		}
	}
	httpx.Success(w, 200, out, "")
}

func (h Handler) addExistingMember(w http.ResponseWriter, r *http.Request, groupID, userID, groupGender string) {
	var ug string
	var userActive, hasRole bool
	e := h.DB.QueryRow(r.Context(), `
		SELECT u."gender"::text, u."isActive",
			EXISTS(SELECT 1 FROM "UserRole" ur WHERE ur."userId"=u."id" AND ur."role"='ANGGOTA')
		FROM "User" u WHERE u."id"=$1`, userID).Scan(&ug, &userActive, &hasRole)
	if e != nil {
		httpx.Error(w, 404, "User tidak ditemukan")
		return
	}
	if !userActive {
		httpx.Error(w, 400, "Akun anggota tidak aktif")
		return
	}
	if !hasRole {
		httpx.Error(w, 400, "User belum terdaftar sebagai anggota")
		return
	}
	if ug != groupGender {
		httpx.Error(w, 400, "Jenis kelamin Anggota harus sesuai kelompok")
		return
	}
	var alreadyHere bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "GroupMember" WHERE "groupId"=$1 AND "userId"=$2 AND "isActive")`, groupID, userID).Scan(&alreadyHere)
	if alreadyHere {
		httpx.Error(w, 400, "Anggota sudah ada di kelompok ini")
		return
	}
	var otherGroup string
	_ = h.DB.QueryRow(r.Context(), `
		SELECT g."name" FROM "GroupMember" gm
		JOIN "Group" g ON g."id"=gm."groupId"
		WHERE gm."userId"=$1 AND gm."isActive" AND g."isActive" AND gm."groupId"<>$2
		LIMIT 1`, userID, groupID).Scan(&otherGroup)
	if otherGroup != "" {
		httpx.Error(w, 400, "Anggota masih terdaftar di kelompok "+otherGroup)
		return
	}
	mid := uuid.NewString()
	_, e = h.DB.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId","isActive") VALUES ($1,$2,$3,true) ON CONFLICT ("groupId","userId") DO UPDATE SET "isActive"=true`, mid, groupID, userID)
	if e != nil {
		httpx.Error(w, 500, "Gagal menambahkan anggota")
		return
	}
	httpx.Success(w, 201, map[string]any{"mode": "existing", "id": mid, "groupId": groupID, "userId": userID}, "Anggota berhasil ditambahkan")
}

func (h Handler) emailTaken(r *http.Request, mail string) bool {
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" WHERE LOWER("email")=$1 AND "isActive") OR EXISTS(SELECT 1 FROM "UserInvitation" WHERE LOWER("email")=$1 AND "status"='PENDING' AND "expiresAt">NOW())`, mail).Scan(&exists)
	return exists
}

func (h Handler) addMember(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in struct {
		UserID   string  `json:"userId"`
		Name     string  `json:"name"`
		Email    string  `json:"email"`
		Phone    *string `json:"phone"`
		Password *string `json:"password"`
	}
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	gender, ok := h.groupGender(r, id)
	if !ok {
		httpx.Error(w, 404, "Kelompok tidak ditemukan")
		return
	}
	if in.UserID != "" {
		if strings.TrimSpace(in.Name) != "" || strings.TrimSpace(in.Email) != "" {
			httpx.Error(w, 400, "Pilih anggota existing atau undang anggota baru, bukan keduanya")
			return
		}
		h.addExistingMember(w, r, id, in.UserID, gender)
		return
	}

	in.Name = strings.TrimSpace(in.Name)
	in.Email = validate.NormalizeEmail(in.Email)
	phone := optionalPhone(in.Phone)
	if len(in.Name) < 2 || in.Email == "" {
		httpx.Error(w, 400, "Nama lengkap dan email wajib diisi")
		return
	}
	if h.emailTaken(r, in.Email) {
		httpx.Error(w, 400, "Email sudah terdaftar atau memiliki undangan aktif. Jika sudah anggota tanpa kelompok, pilih dari daftar anggota terdaftar.")
		return
	}

	hasPassword := in.Password != nil && strings.TrimSpace(*in.Password) != ""
	if hasPassword {
		if err := auth.ValidatePassword(*in.Password); err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		hash, he := auth.HashPassword(*in.Password)
		if he != nil {
			httpx.Error(w, 500, "Gagal membuat anggota")
			return
		}
		tx, e := h.DB.Begin(r.Context())
		if e != nil {
			httpx.Error(w, 500, "Gagal membuat anggota")
			return
		}
		defer tx.Rollback(r.Context())
		uid := uuid.NewString()
		mid := uuid.NewString()
		_, e = tx.Exec(r.Context(), `INSERT INTO "User" ("id","name","email","phone","password","gender","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"Gender",NOW())`, uid, in.Name, in.Email, phone, hash, gender)
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "UserRole" ("id","userId","role") VALUES ($1,$2,'ANGGOTA')`, uuid.NewString(), uid)
		}
		if e == nil {
			_, e = tx.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId","isActive") VALUES ($1,$2,$3,true)`, mid, id, uid)
		}
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal membuat anggota")
			return
		}
		httpx.Success(w, 201, map[string]any{"mode": "direct", "id": mid, "groupId": id, "userId": uid}, "Anggota berhasil ditambahkan")
		return
	}

	c, _ := middleware.Claims(r)
	token, iid := uuid.NewString(), uuid.NewString()
	expires := time.Now().AddDate(0, 0, h.Config.InvitationExpireDays)
	_, e := h.DB.Exec(r.Context(), `INSERT INTO "UserInvitation" ("id","name","email","phone","role","alsoAsPembina","gender","groupId","token","invitedById","expiresAt") VALUES ($1,$2,$3,$4,'ANGGOTA',false,$5::"Gender",$6,$7,$8,$9)`, iid, in.Name, in.Email, phone, gender, id, token, c.UserID, expires)
	if e != nil {
		httpx.Error(w, 500, "Gagal membuat undangan anggota")
		return
	}
	if e = email.New(h.Config).SendInvitation(r.Context(), in.Email, in.Name, h.Config.AppURL+"/set-password?token="+token); e != nil {
		httpx.Error(w, 502, "Undangan dibuat, namun email gagal dikirim")
		return
	}
	httpx.Success(w, 201, map[string]any{"mode": "invite", "invitation": map[string]string{"id": iid, "email": in.Email}}, "Undangan anggota berhasil dikirim")
}
func (h Handler) member(w http.ResponseWriter, r *http.Request) {
	id, uid := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	if !h.groupAccess(r, id, false) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var mid string
	var joined time.Time
	var name, email, gender string
	var phone *string
	var birthPlace, address, tiktok, instagram, facebook, socialX *string
	var fatherName, fatherPhone, motherName, motherPhone, hobby *string
	var birthDate *time.Time
	var points int
	var lastLogin *time.Time
	var createdAt time.Time
	var gName, gLevel, gGender, schoolID, schoolName string
	e := h.DB.QueryRow(r.Context(), `
		SELECT gm."id", gm."joinedAt",
		       u."name", u."email", u."phone", u."gender"::text, u."totalPoints", u."lastLoginAt", u."createdAt",
		       u."birthPlace", u."birthDate", u."address",
		       u."tiktok", u."instagram", u."facebook", u."socialX",
		       u."fatherName", u."fatherPhone", u."motherName", u."motherPhone", u."hobby",
		       g."name", g."level"::text, g."gender"::text,
		       s."id", s."name"
		FROM "GroupMember" gm
		JOIN "User" u ON u."id"=gm."userId"
		JOIN "Group" g ON g."id"=gm."groupId"
		JOIN "School" s ON s."id"=g."schoolId"
		WHERE gm."groupId"=$1 AND gm."userId"=$2 AND gm."isActive"=true`, id, uid).
		Scan(&mid, &joined, &name, &email, &phone, &gender, &points, &lastLogin, &createdAt,
			&birthPlace, &birthDate, &address,
			&tiktok, &instagram, &facebook, &socialX,
			&fatherName, &fatherPhone, &motherName, &motherPhone, &hobby,
			&gName, &gLevel, &gGender, &schoolID, &schoolName)
	if e != nil {
		httpx.Error(w, 404, "Anggota tidak ditemukan di kelompok ini")
		return
	}
	var birthDateStr any
	if birthDate != nil {
		birthDateStr = birthDate.Format("2006-01-02")
	}

	// Monday of join week (WIB), same rule as Express getMonday
	loc := time.FixedZone("WIB", 7*3600)
	joinedLocal := joined.In(loc)
	joinedMonday := joinedLocal.AddDate(0, 0, -((int(joinedLocal.Weekday())+6)%7))
	joinedMonday = time.Date(joinedMonday.Year(), joinedMonday.Month(), joinedMonday.Day(), 0, 0, 0, 0, loc)

	rows, e := h.DB.Query(r.Context(), `
		SELECT we."weekDate",
		       EXISTS(
		         SELECT 1 FROM "EvaluationAttendance" a
		         WHERE a."evaluationId"=we."id" AND a."userId"=$2 AND a."status"='HADIR'
		       ) AS hadir
		FROM "WeeklyEvaluation" we
		WHERE we."groupId"=$1 AND we."isSubmitted"=true AND we."weekDate">=$3
		ORDER BY we."weekDate"`, id, uid, joinedMonday)
	totalPekan, totalHadir := 0, 0
	if e == nil {
		defer rows.Close()
		for rows.Next() {
			var weekDate time.Time
			var hadir bool
			if rows.Scan(&weekDate, &hadir) == nil {
				totalPekan++
				if hadir {
					totalHadir++
				}
			}
		}
	}
	var attendanceRate any
	if totalPekan > 0 {
		attendanceRate = int(math.Round(float64(totalHadir) / float64(totalPekan) * 100))
	} else {
		attendanceRate = nil
	}

	httpx.Success(w, 200, map[string]any{
		"id": mid, "userId": uid, "joinedAt": joined,
		"totalPekan": totalPekan, "totalHadir": totalHadir, "attendanceRate": attendanceRate,
		"user": map[string]any{
			"id": uid, "name": name, "email": email, "phone": phone,
			"gender": gender, "totalPoints": points, "lastLoginAt": lastLogin, "createdAt": createdAt,
			"birthPlace": birthPlace, "birthDate": birthDateStr, "address": address,
			"tiktok": tiktok, "instagram": instagram, "facebook": facebook, "socialX": socialX,
			"fatherName": fatherName, "fatherPhone": fatherPhone,
			"motherName": motherName, "motherPhone": motherPhone, "hobby": hobby,
		},
		"group":  map[string]any{"id": id, "name": gName, "level": gLevel, "gender": gGender},
		"school": map[string]any{"id": schoolID, "name": schoolName},
	}, "")
}
func (h Handler) updateMember(w http.ResponseWriter, r *http.Request) {
	id, uid := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in struct {
		Name, Email string
		Phone       *string
		Gender      *string
	}
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	in.Email = validate.NormalizeEmail(in.Email)
	if in.Gender != nil {
		var gg string
		_ = h.DB.QueryRow(r.Context(), `SELECT "gender"::text FROM "Group" WHERE "id"=$1`, id).Scan(&gg)
		if *in.Gender != gg {
			httpx.Error(w, 400, "Jenis kelamin Anggota harus sesuai kelompok")
			return
		}
	}
	tag, e := h.DB.Exec(r.Context(), `UPDATE "User" SET "name"=COALESCE(NULLIF($1,''),"name"),"email"=COALESCE(NULLIF($2,''),"email"),"phone"=COALESCE($3,"phone"),"gender"=COALESCE($4::"Gender","gender"),"updatedAt"=NOW() WHERE "id"=$5 AND EXISTS(SELECT 1 FROM "GroupMember" WHERE "groupId"=$6 AND "userId"=$5 AND "isActive")`, in.Name, in.Email, in.Phone, in.Gender, uid, id)
	if e != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, 400, "Gagal memperbarui anggota")
		return
	}
	h.member(w, r)
}
func (h Handler) removeMember(w http.ResponseWriter, r *http.Request) {
	id, uid := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	tag, e := h.DB.Exec(r.Context(), `UPDATE "GroupMember" SET "isActive"=false WHERE "groupId"=$1 AND "userId"=$2`, id, uid)
	if e != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, 404, "Anggota tidak ditemukan")
		return
	}
	httpx.Success(w, 200, nil, "Anggota berhasil dihapus")
}
func gender(v string) bool { return v == "IKHWAN" || v == "AKHWAT" }
func level(v string) bool  { return v == "LEVEL_1" || v == "LEVEL_2" }
func has(s []string, x string) bool {
	for _, v := range s {
		if v == x {
			return true
		}
	}
	return false
}

var _ = pgx.ErrNoRows
