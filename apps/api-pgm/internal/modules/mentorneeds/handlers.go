package mentorneeds

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/db"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/middleware"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/notify"
	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/validate"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB     *pgxpool.Pool
	Config config.Config
}

func (h Handler) PublicRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.publicList)
	r.Get("/{schoolId}", h.publicDetail)
	r.With(applyLimit.Middleware).Post("/{schoolId}/apply", h.apply)
	return r
}

func (h Handler) ProtectedRoutes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(h.Config))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Get("/", h.listNeeds)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Get("/schools/{schoolId}", h.getNeed)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Put("/schools/{schoolId}", h.upsertNeed)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Get("/schools/{schoolId}/applications", h.listApplications)
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Patch("/applications/{id}", h.updateApplicationStatus)
	return r
}

var applyLimit = middleware.NewRateLimit(30, time.Minute)

func admin(roles []string) bool {
	for _, r := range roles {
		if r == "ADMIN" || r == "SUPERADMIN" {
			return true
		}
	}
	return false
}

func (h Handler) canAccessSchool(r *http.Request, schoolID string) bool {
	c, ok := middleware.Claims(r)
	if !ok {
		return false
	}
	if admin(c.Roles) {
		return true
	}
	var okExists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, schoolID).Scan(&okExists)
	return okExists
}

type needInput struct {
	Description string `json:"description"`
	NeedIkhwan  int    `json:"needIkhwan"`
	NeedAkhwat  int    `json:"needAkhwat"`
	IsPublished bool   `json:"isPublished"`
}

type applyInput struct {
	Name            string `json:"name"`
	Whatsapp        string `json:"whatsapp"`
	Age             int    `json:"age"`
	Gender          string `json:"gender"`
	Address         string `json:"address"`
	AsalSma         string `json:"asalSma"`
	MurobbiName     string `json:"murobbiName"`
	MurobbiWhatsapp string `json:"murobbiWhatsapp"`
}

type statusInput struct {
	Status string `json:"status"`
}

func decode(r *http.Request, v any) bool {
	return json.NewDecoder(r.Body).Decode(v) == nil
}

func filledCounts(db *pgxpool.Pool, r *http.Request, needID string) (ikhwan, akhwat int, err error) {
	err = db.QueryRow(r.Context(), `
		SELECT
			COALESCE(SUM(CASE WHEN "gender"='IKHWAN'::"Gender" THEN 1 ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN "gender"='AKHWAT'::"Gender" THEN 1 ELSE 0 END),0)
		FROM "MentorApplication"
		WHERE "mentorNeedId"=$1 AND "status" IN ('PENDING'::"MentorApplicationStatus",'ACCEPTED'::"MentorApplicationStatus")`, needID).Scan(&ikhwan, &akhwat)
	return
}

func quotaMap(needIkhwan, needAkhwat, filledIkhwan, filledAkhwat int) map[string]any {
	remI := needIkhwan - filledIkhwan
	if remI < 0 {
		remI = 0
	}
	remA := needAkhwat - filledAkhwat
	if remA < 0 {
		remA = 0
	}
	return map[string]any{
		"ikhwan": map[string]int{"need": needIkhwan, "filled": filledIkhwan, "remaining": remI},
		"akhwat": map[string]int{"need": needAkhwat, "filled": filledAkhwat, "remaining": remA},
	}
}

func (h Handler) publicList(w http.ResponseWriter, r *http.Request) {
	rows, e := h.DB.Query(r.Context(), `
		SELECT mn."id", mn."schoolId", mn."description", mn."needIkhwan", mn."needAkhwat",
		       s."name", s."city", s."address", s."mapsUrl",
		       COALESCE((
		         SELECT json_agg(u."name" ORDER BY u."name")
		         FROM "User" u
		         INNER JOIN "UserSchool" us ON us."userId"=u."id"
		         INNER JOIN "UserRole" ur ON ur."userId"=u."id"
		         WHERE us."schoolId"=s."id" AND u."isActive"=true AND ur."role"='PJ_SEKOLAH'::"Role"
		       ), '[]'::json)
		FROM "MentorNeed" mn
		INNER JOIN "School" s ON s."id"=mn."schoolId"
		WHERE mn."isPublished"=true AND s."isActive"=true
		ORDER BY ` + db.NaturalName(`s."name"`))
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil daftar kebutuhan mentor")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var needID, schoolID, desc, name, city string
		var address, mapsUrl *string
		var needI, needA int
		var pjNames json.RawMessage
		if rows.Scan(&needID, &schoolID, &desc, &needI, &needA, &name, &city, &address, &mapsUrl, &pjNames) != nil {
			continue
		}
		fi, fa, err := filledCounts(h.DB, r, needID)
		if err != nil {
			httpx.Error(w, 500, "Gagal menghitung kuota")
			return
		}
		out = append(out, map[string]any{
			"id": needID, "schoolId": schoolID, "description": desc,
			"schoolName": name, "city": city, "address": address, "mapsUrl": mapsUrl,
			"pjNames": pjNames, "quota": quotaMap(needI, needA, fi, fa),
		})
	}
	httpx.Success(w, 200, out, "")
}

func (h Handler) publicDetail(w http.ResponseWriter, r *http.Request) {
	schoolID := chi.URLParam(r, "schoolId")
	var needID, desc, name, city string
	var address, mapsUrl *string
	var needI, needA int
	var pjNames json.RawMessage
	e := h.DB.QueryRow(r.Context(), `
		SELECT mn."id", mn."description", mn."needIkhwan", mn."needAkhwat",
		       s."name", s."city", s."address", s."mapsUrl",
		       COALESCE((
		         SELECT json_agg(u."name" ORDER BY u."name")
		         FROM "User" u
		         INNER JOIN "UserSchool" us ON us."userId"=u."id"
		         INNER JOIN "UserRole" ur ON ur."userId"=u."id"
		         WHERE us."schoolId"=s."id" AND u."isActive"=true AND ur."role"='PJ_SEKOLAH'::"Role"
		       ), '[]'::json)
		FROM "MentorNeed" mn
		INNER JOIN "School" s ON s."id"=mn."schoolId"
		WHERE mn."schoolId"=$1 AND mn."isPublished"=true AND s."isActive"=true`, schoolID).Scan(
		&needID, &desc, &needI, &needA, &name, &city, &address, &mapsUrl, &pjNames,
	)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Kebutuhan mentor tidak ditemukan atau belum dipublish")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil detail")
		return
	}
	fi, fa, err := filledCounts(h.DB, r, needID)
	if err != nil {
		httpx.Error(w, 500, "Gagal menghitung kuota")
		return
	}
	httpx.Success(w, 200, map[string]any{
		"id": needID, "schoolId": schoolID, "description": desc,
		"schoolName": name, "city": city, "address": address, "mapsUrl": mapsUrl,
		"pjNames": pjNames, "quota": quotaMap(needI, needA, fi, fa),
	}, "")
}

func (h Handler) apply(w http.ResponseWriter, r *http.Request) {
	schoolID := chi.URLParam(r, "schoolId")
	var in applyInput
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Address = strings.TrimSpace(in.Address)
	in.AsalSma = strings.TrimSpace(in.AsalSma)
	in.MurobbiName = strings.TrimSpace(in.MurobbiName)
	in.Gender = strings.ToUpper(strings.TrimSpace(in.Gender))
	wa := validate.NormalizeWhatsApp(in.Whatsapp)
	murobbiWA := validate.NormalizeWhatsApp(in.MurobbiWhatsapp)
	if in.Name == "" || wa == "" || in.Age < 15 || in.Age > 80 ||
		(in.Gender != "IKHWAN" && in.Gender != "AKHWAT") ||
		in.Address == "" || in.AsalSma == "" || in.MurobbiName == "" || murobbiWA == "" {
		httpx.Error(w, 400, "Data pendaftaran tidak lengkap atau nomor WhatsApp tidak valid")
		return
	}
	in.Whatsapp = wa
	in.MurobbiWhatsapp = murobbiWA

	tx, e := h.DB.Begin(r.Context())
	if e != nil {
		httpx.Error(w, 500, "Gagal mendaftar")
		return
	}
	defer tx.Rollback(r.Context())

	var needID string
	var needI, needA int
	e = tx.QueryRow(r.Context(), `
		SELECT mn."id", mn."needIkhwan", mn."needAkhwat"
		FROM "MentorNeed" mn
		INNER JOIN "School" s ON s."id"=mn."schoolId"
		WHERE mn."schoolId"=$1 AND mn."isPublished"=true AND s."isActive"=true
		FOR UPDATE OF mn`, schoolID).Scan(&needID, &needI, &needA)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Kebutuhan mentor tidak ditemukan atau belum dipublish")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal mendaftar")
		return
	}

	var filled int
	e = tx.QueryRow(r.Context(), `
		SELECT count(*) FROM "MentorApplication"
		WHERE "mentorNeedId"=$1 AND "gender"=$2::"Gender"
		  AND "status" IN ('PENDING'::"MentorApplicationStatus",'ACCEPTED'::"MentorApplicationStatus")`,
		needID, in.Gender).Scan(&filled)
	if e != nil {
		httpx.Error(w, 500, "Gagal memeriksa kuota")
		return
	}
	need := needI
	if in.Gender == "AKHWAT" {
		need = needA
	}
	if filled >= need {
		httpx.Error(w, 400, "Kuota mentor untuk jenis kelamin ini sudah penuh")
		return
	}

	id := uuid.NewString()
	_, e = tx.Exec(r.Context(), `
		INSERT INTO "MentorApplication"
		("id","mentorNeedId","name","whatsapp","age","gender","address","asalSma","murobbiName","murobbiWhatsapp","updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6::"Gender",$7,$8,$9,$10,NOW())`,
		id, needID, in.Name, in.Whatsapp, in.Age, in.Gender, in.Address, in.AsalSma, in.MurobbiName, in.MurobbiWhatsapp)
	if e != nil || tx.Commit(r.Context()) != nil {
		httpx.Error(w, 500, "Gagal menyimpan pendaftaran")
		return
	}

	var schoolName string
	_ = h.DB.QueryRow(r.Context(), `SELECT "name" FROM "School" WHERE "id"=$1`, schoolID).Scan(&schoolName)
	genderLabel := "Ikhwan"
	if in.Gender == "AKHWAT" {
		genderLabel = "Akhwat"
	}
	ref := schoolID
	if pjs, err := notify.PJUserIDsForSchool(r.Context(), h.DB, schoolID); err == nil && len(pjs) > 0 {
		notify.CreateMany(r.Context(), h.DB, pjs, "NEW_MENTOR_APPLICATION",
			"Pendaftar mentor baru",
			in.Name+" ("+genderLabel+") — "+schoolName,
			&ref)
	}

	httpx.Success(w, 201, map[string]any{"id": id}, "Pendaftaran berhasil dikirim")
}

func (h Handler) listNeeds(w http.ResponseWriter, r *http.Request) {
	c, _ := middleware.Claims(r)
	q := `
		SELECT s."id", s."name", s."city", s."address", s."mapsUrl",
		       mn."id", mn."description", mn."needIkhwan", mn."needAkhwat", mn."isPublished", mn."updatedAt"
		FROM "School" s
		LEFT JOIN "MentorNeed" mn ON mn."schoolId"=s."id"
		WHERE s."isActive"=true`
	args := []any{}
	if !admin(c.Roles) {
		q += ` AND EXISTS(SELECT 1 FROM "UserSchool" us WHERE us."schoolId"=s."id" AND us."userId"=$1)`
		args = append(args, c.UserID)
	}
	q += ` ORDER BY ` + db.NaturalName(`s."name"`)
	rows, e := h.DB.Query(r.Context(), q, args...)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil kebutuhan mentor")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var schoolID, name, city string
		var address, mapsUrl *string
		var needID, desc *string
		var needI, needA *int
		var published *bool
		var updated *time.Time
		if rows.Scan(&schoolID, &name, &city, &address, &mapsUrl, &needID, &desc, &needI, &needA, &published, &updated) != nil {
			continue
		}
		item := map[string]any{
			"schoolId": schoolID, "schoolName": name, "city": city,
			"address": address, "mapsUrl": mapsUrl,
		}
		if needID != nil {
			fi, fa, err := filledCounts(h.DB, r, *needID)
			if err != nil {
				httpx.Error(w, 500, "Gagal menghitung kuota")
				return
			}
			ni, na := 0, 0
			if needI != nil {
				ni = *needI
			}
			if needA != nil {
				na = *needA
			}
			item["id"] = *needID
			item["description"] = desc
			item["isPublished"] = published
			item["updatedAt"] = updated
			item["quota"] = quotaMap(ni, na, fi, fa)
			var pending int
			_ = h.DB.QueryRow(r.Context(), `SELECT count(*) FROM "MentorApplication" WHERE "mentorNeedId"=$1 AND "status"='PENDING'::"MentorApplicationStatus"`, *needID).Scan(&pending)
			item["pendingCount"] = pending
		} else {
			item["id"] = nil
			item["description"] = nil
			item["isPublished"] = false
			item["quota"] = quotaMap(0, 0, 0, 0)
			item["pendingCount"] = 0
		}
		out = append(out, item)
	}
	httpx.Success(w, 200, out, "")
}

func (h Handler) getNeed(w http.ResponseWriter, r *http.Request) {
	schoolID := chi.URLParam(r, "schoolId")
	if !h.canAccessSchool(r, schoolID) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var schoolName, city string
	var address, mapsUrl *string
	e := h.DB.QueryRow(r.Context(), `SELECT "name","city","address","mapsUrl" FROM "School" WHERE "id"=$1 AND "isActive"=true`, schoolID).Scan(&schoolName, &city, &address, &mapsUrl)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil PGM")
		return
	}
	var needID, desc *string
	var needI, needA *int
	var published *bool
	var updated *time.Time
	_ = h.DB.QueryRow(r.Context(), `
		SELECT "id","description","needIkhwan","needAkhwat","isPublished","updatedAt"
		FROM "MentorNeed" WHERE "schoolId"=$1`, schoolID).Scan(&needID, &desc, &needI, &needA, &published, &updated)

	item := map[string]any{
		"schoolId": schoolID, "schoolName": schoolName, "city": city,
		"address": address, "mapsUrl": mapsUrl,
	}
	if needID != nil {
		fi, fa, err := filledCounts(h.DB, r, *needID)
		if err != nil {
			httpx.Error(w, 500, "Gagal menghitung kuota")
			return
		}
		ni, na := 0, 0
		if needI != nil {
			ni = *needI
		}
		if needA != nil {
			na = *needA
		}
		item["id"] = *needID
		item["description"] = desc
		item["needIkhwan"] = ni
		item["needAkhwat"] = na
		item["isPublished"] = published
		item["updatedAt"] = updated
		item["quota"] = quotaMap(ni, na, fi, fa)
	} else {
		item["id"] = nil
		item["description"] = ""
		item["needIkhwan"] = 0
		item["needAkhwat"] = 0
		item["isPublished"] = false
		item["quota"] = quotaMap(0, 0, 0, 0)
	}
	httpx.Success(w, 200, item, "")
}

func (h Handler) upsertNeed(w http.ResponseWriter, r *http.Request) {
	schoolID := chi.URLParam(r, "schoolId")
	if !h.canAccessSchool(r, schoolID) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var in needInput
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	in.Description = strings.TrimSpace(in.Description)
	if in.Description == "" {
		httpx.Error(w, 400, "Deskripsi wajib diisi")
		return
	}
	if in.NeedIkhwan < 0 || in.NeedAkhwat < 0 {
		httpx.Error(w, 400, "Kebutuhan mentor tidak valid")
		return
	}
	if in.IsPublished && in.NeedIkhwan+in.NeedAkhwat < 1 {
		httpx.Error(w, 400, "Publish membutuhkan minimal 1 kuota ikhwan atau akhwat")
		return
	}
	var exists bool
	_ = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "School" WHERE "id"=$1 AND "isActive"=true)`, schoolID).Scan(&exists)
	if !exists {
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	var existingNeedID string
	if e := h.DB.QueryRow(r.Context(), `SELECT "id" FROM "MentorNeed" WHERE "schoolId"=$1`, schoolID).Scan(&existingNeedID); e == nil {
		fi, fa, err := filledCounts(h.DB, r, existingNeedID)
		if err != nil {
			httpx.Error(w, 500, "Gagal menghitung kuota")
			return
		}
		if in.NeedIkhwan < fi {
			httpx.Error(w, 400, "Kebutuhan ikhwan tidak boleh kurang dari pendaftar aktif ("+strconv.Itoa(fi)+")")
			return
		}
		if in.NeedAkhwat < fa {
			httpx.Error(w, 400, "Kebutuhan akhwat tidak boleh kurang dari pendaftar aktif ("+strconv.Itoa(fa)+")")
			return
		}
	}
	c, _ := middleware.Claims(r)
	id := uuid.NewString()
	var outID string
	var published bool
	e := h.DB.QueryRow(r.Context(), `
		INSERT INTO "MentorNeed" ("id","schoolId","description","needIkhwan","needAkhwat","isPublished","createdById","updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
		ON CONFLICT ("schoolId") DO UPDATE SET
			"description"=EXCLUDED."description",
			"needIkhwan"=EXCLUDED."needIkhwan",
			"needAkhwat"=EXCLUDED."needAkhwat",
			"isPublished"=EXCLUDED."isPublished",
			"updatedAt"=NOW()
		RETURNING "id","isPublished"`,
		id, schoolID, in.Description, in.NeedIkhwan, in.NeedAkhwat, in.IsPublished, c.UserID,
	).Scan(&outID, &published)
	if e != nil {
		httpx.Error(w, 500, "Gagal menyimpan kebutuhan mentor")
		return
	}
	fi, fa, err := filledCounts(h.DB, r, outID)
	if err != nil {
		httpx.Error(w, 500, "Gagal menghitung kuota")
		return
	}
	httpx.Success(w, 200, map[string]any{
		"id": outID, "schoolId": schoolID, "description": in.Description,
		"needIkhwan": in.NeedIkhwan, "needAkhwat": in.NeedAkhwat, "isPublished": published,
		"quota": quotaMap(in.NeedIkhwan, in.NeedAkhwat, fi, fa),
	}, "Kebutuhan mentor berhasil disimpan")
}

func (h Handler) listApplications(w http.ResponseWriter, r *http.Request) {
	schoolID := chi.URLParam(r, "schoolId")
	if !h.canAccessSchool(r, schoolID) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	var needID string
	e := h.DB.QueryRow(r.Context(), `SELECT "id" FROM "MentorNeed" WHERE "schoolId"=$1`, schoolID).Scan(&needID)
	if e == pgx.ErrNoRows {
		httpx.Success(w, 200, []any{}, "")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil pendaftar")
		return
	}
	rows, e := h.DB.Query(r.Context(), `
		SELECT "id","name","whatsapp","age","gender"::text,"address","asalSma","murobbiName","murobbiWhatsapp","status"::text,"createdAt"
		FROM "MentorApplication"
		WHERE "mentorNeedId"=$1
		ORDER BY
			CASE "status"
				WHEN 'PENDING'::"MentorApplicationStatus" THEN 0
				WHEN 'ACCEPTED'::"MentorApplicationStatus" THEN 1
				ELSE 2
			END,
			"createdAt" DESC`, needID)
	if e != nil {
		httpx.Error(w, 500, "Gagal mengambil pendaftar")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, wa, gender, address, asal, murobbi, murobbiWa, status string
		var age int
		var created time.Time
		if rows.Scan(&id, &name, &wa, &age, &gender, &address, &asal, &murobbi, &murobbiWa, &status, &created) != nil {
			continue
		}
		out = append(out, map[string]any{
			"id": id, "name": name, "whatsapp": wa, "age": age, "gender": gender,
			"address": address, "asalSma": asal, "murobbiName": murobbi, "murobbiWhatsapp": murobbiWa,
			"status": status, "createdAt": created,
		})
	}
	httpx.Success(w, 200, out, "")
}

func (h Handler) updateApplicationStatus(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	var in statusInput
	if !decode(r, &in) {
		httpx.Error(w, 400, "Body tidak valid")
		return
	}
	in.Status = strings.ToUpper(strings.TrimSpace(in.Status))
	if in.Status != "PENDING" && in.Status != "ACCEPTED" && in.Status != "REJECTED" {
		httpx.Error(w, 400, "Status tidak valid")
		return
	}

	var schoolID, gender string
	var needID string
	var needI, needA int
	e := h.DB.QueryRow(r.Context(), `
		SELECT mn."id", mn."schoolId", mn."needIkhwan", mn."needAkhwat", a."gender"::text
		FROM "MentorApplication" a
		INNER JOIN "MentorNeed" mn ON mn."id"=a."mentorNeedId"
		WHERE a."id"=$1`, appID).Scan(&needID, &schoolID, &needI, &needA, &gender)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Pendaftaran tidak ditemukan")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal memperbarui status")
		return
	}
	if !h.canAccessSchool(r, schoolID) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}

	if in.Status == "PENDING" || in.Status == "ACCEPTED" {
		var filled int
		_ = h.DB.QueryRow(r.Context(), `
			SELECT count(*) FROM "MentorApplication"
			WHERE "mentorNeedId"=$1 AND "gender"=$2::"Gender"
			  AND "status" IN ('PENDING'::"MentorApplicationStatus",'ACCEPTED'::"MentorApplicationStatus")
			  AND "id"<>$3`, needID, gender, appID).Scan(&filled)
		need := needI
		if gender == "AKHWAT" {
			need = needA
		}
		if filled+1 > need {
			httpx.Error(w, 400, "Kuota mentor untuk jenis kelamin ini sudah penuh")
			return
		}
	}

	var id, status string
	e = h.DB.QueryRow(r.Context(), `
		UPDATE "MentorApplication" SET "status"=$1::"MentorApplicationStatus", "updatedAt"=NOW()
		WHERE "id"=$2 RETURNING "id","status"::text`, in.Status, appID).Scan(&id, &status)
	if e != nil {
		httpx.Error(w, 500, "Gagal memperbarui status")
		return
	}
	httpx.Success(w, 200, map[string]any{"id": id, "status": status}, "Status pendaftaran diperbarui")
}
