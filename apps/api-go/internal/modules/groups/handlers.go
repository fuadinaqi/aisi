package groups

import (
	"encoding/json"
	"math"
	"net/http"
	"time"

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
	r.Use(middleware.RequireAuth(h.Config))
	r.Get("/", h.list)
	r.With(middleware.RequireRole("PJ_SEKOLAH", "ADMIN", "SUPERADMIN")).Post("/", h.create)
	r.Get("/{id}", h.detail)
	r.Put("/{id}", h.update)
	r.With(middleware.RequireRole("PJ_SEKOLAH", "ADMIN", "SUPERADMIN")).Delete("/{id}", h.remove)
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
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "User" u JOIN "UserRole" ur ON ur."userId"=u."id" WHERE u."id"=$1 AND u."isActive" AND u."gender"=$2::"Gender" AND ur."role"='PEMBINA')`, in.PembinaID, in.Gender).Scan(&pembinaOK)
	if !pembinaOK {
		httpx.Error(w, 400, "Pembina tidak ditemukan atau jenis kelamin tidak sesuai kelompok")
		return
	}
	id := uuid.NewString()
	_, e := h.DB.Exec(r.Context(), `INSERT INTO "Group" ("id","name","level","gender","schoolId","pembinaId","updatedAt") VALUES ($1,$2,$3::"GroupLevel",$4::"Gender",$5,$6,NOW())`, id, in.Name, in.Level, in.Gender, in.SchoolID, in.PembinaID)
	if e != nil {
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
		var pg string
		_ = h.DB.QueryRow(r.Context(), `SELECT "gender"::text FROM "User" WHERE "id"=$1`, oldPembina).Scan(&pg)
		if pg != in.Gender {
			httpx.Error(w, 400, "Jenis kelamin Pembina kelompok harus sesuai")
			return
		}
	}
	if in.PembinaID != "" && in.PembinaID != oldPembina {
		c, _ := middleware.Claims(r)
		if !admin(c.Roles) && !has(c.Roles, "PJ_SEKOLAH") {
			httpx.Error(w, 403, "Hanya PJ Sekolah atau Admin yang dapat mengganti pembina")
			return
		}
	}
	_, e = h.DB.Exec(r.Context(), `UPDATE "Group" SET "name"=COALESCE(NULLIF($1,''),"name"),"level"=COALESCE(NULLIF($2,'')::"GroupLevel","level"),"gender"=COALESCE(NULLIF($3,'')::"Gender","gender"),"pembinaId"=COALESCE(NULLIF($4,''),"pembinaId"),"isActive"=COALESCE($5,"isActive"),"updatedAt"=NOW() WHERE "id"=$6`, in.Name, in.Level, in.Gender, in.PembinaID, in.IsActive, id)
	if e != nil {
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
func (h Handler) addMember(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.groupAccess(r, id, true) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in struct {
		UserID string `json:"userId"`
	}
	if !decode(r, &in) || in.UserID == "" {
		httpx.Error(w, 400, "userId wajib diisi")
		return
	}
	var gg, ug string
	e := h.DB.QueryRow(r.Context(), `SELECT g."gender"::text,u."gender"::text FROM "Group" g JOIN "User" u ON u."id"=$2 WHERE g."id"=$1 AND g."isActive"`, id, in.UserID).Scan(&gg, &ug)
	if e != nil {
		httpx.Error(w, 404, "Kelompok atau user tidak ditemukan")
		return
	}
	if gg != ug {
		httpx.Error(w, 400, "Jenis kelamin Anggota harus sesuai kelompok")
		return
	}
	mid := uuid.NewString()
	_, e = h.DB.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId","isActive") VALUES ($1,$2,$3,true) ON CONFLICT ("groupId","userId") DO UPDATE SET "isActive"=true`, mid, id, in.UserID)
	if e != nil {
		httpx.Error(w, 500, "Gagal menambahkan anggota")
		return
	}
	httpx.Success(w, 201, map[string]string{"id": mid, "groupId": id, "userId": in.UserID}, "Anggota berhasil ditambahkan")
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
