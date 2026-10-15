package evaluations

import (
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
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
)

type attendance struct {
	UserID string  `json:"userId"`
	Status string  `json:"status"`
	Note   *string `json:"note"`
}
type evaluationInput struct {
	GroupID     string       `json:"groupId"`
	WeekDate    string       `json:"weekDate"`
	Notes       *string      `json:"notes"`
	Attendances []attendance `json:"attendances"`
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Get("/laporan", laporan(db))
	r.Post("/", create(db))
	r.Get("/{id}/agenda-photo", agendaPhoto(db, c))
	r.Get("/{id}", detail(db))
	r.Put("/{id}", update(db))
	r.Delete("/{id}", remove(db, c))
	r.Post("/{id}/submit", submit(db))
	r.Post("/{id}/photos", photos(db, c))
	return r
}
func has(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}
func monday(s string) (time.Time, error) {
	t, err := time.ParseInLocation("2006-01-02", s[:min(len(s), 10)], time.FixedZone("WIB", 7*3600))
	if err != nil {
		return time.Time{}, err
	}
	d := (int(t.Weekday()) + 6) % 7
	return t.AddDate(0, 0, -d), nil
}
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func canPembina(r *http.Request, db *pgxpool.Pool, groupID string) bool {
	c, ok := middleware.Claims(r)
	if !ok || !has(c.Roles, "PEMBINA") {
		return false
	}
	var n int
	_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "Group" WHERE "id"=$1 AND "pembinaId"=$2`, groupID, c.UserID).Scan(&n)
	return n > 0
}
func allowedEvaluation(r *http.Request, db *pgxpool.Pool, groupID string) (int, string) {
	c, ok := middleware.Claims(r)
	if !ok {
		return 401, "Autentikasi diperlukan"
	}
	if has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") {
		return 0, ""
	}
	if has(c.Roles, "PEMBINA") {
		if canPembina(r, db, groupID) {
			return 0, ""
		}
		return 403, "Akses ditolak"
	}
	if has(c.Roles, "PJ_SEKOLAH") {
		var n int
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "Group" g JOIN "UserSchool" us ON us."schoolId"=g."schoolId" WHERE g."id"=$1 AND us."userId"=$2`, groupID, c.UserID).Scan(&n)
		if n > 0 {
			return 0, ""
		}
		return 403, "Akses ditolak"
	}
	return 403, "Akses ditolak"
}
func decode(r *http.Request, v any) bool {
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, 2<<20)).Decode(v) == nil
}
func validAttendance(a []attendance) bool {
	for _, v := range a {
		if v.UserID == "" || (v.Status != "HADIR" && v.Status != "TIDAK_HADIR" && v.Status != "IZIN" && v.Status != "SAKIT") {
			return false
		}
	}
	return true
}
func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		q := r.URL.Query()
		page, limit := page(q.Get("page"), q.Get("limit"))
		args := []any{}
		where := []string{"1=1"}
		if id := q.Get("groupId"); id != "" {
			args = append(args, id)
			where = append(where, `e."groupId"=$`+strconv.Itoa(len(args)))
		}
		if s := q.Get("weekDate"); s != "" {
			d, err := monday(s)
			if err != nil {
				httpx.Error(w, 400, "weekDate tidak valid")
				return
			}
			args = append(args, d)
			where = append(where, `e."weekDate"=$`+strconv.Itoa(len(args)))
		}
		switch {
		case has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN"):
		case has(c.Roles, "PEMBINA"):
			args = append(args, c.UserID)
			where = append(where, `g."pembinaId"=$`+strconv.Itoa(len(args)))
		case has(c.Roles, "PJ_SEKOLAH"):
			args = append(args, c.UserID)
			where = append(where, `EXISTS(SELECT 1 FROM "UserSchool" us WHERE us."schoolId"=g."schoolId" AND us."userId"=$`+strconv.Itoa(len(args))+`)`)
		default:
			where = append(where, "FALSE")
		}
		if school := q.Get("schoolId"); school != "" {
			args = append(args, school)
			where = append(where, `g."schoolId"=$`+strconv.Itoa(len(args)))
		}
		sqlWhere := strings.Join(where, " AND ")
		var total int
		if err := db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE `+sqlWhere, args...).Scan(&total); err != nil {
			httpx.Error(w, 500, "Gagal memuat evaluasi")
			return
		}
		args = append(args, (page-1)*limit, limit)
		rows, err := db.Query(r.Context(), `SELECT e."id",e."groupId",e."createdById",e."weekDate",e."notes",e."photoUrls",e."isSubmitted",e."submittedAt",e."createdAt",e."updatedAt",json_build_object('id',g."id",'name',g."name") FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE `+sqlWhere+` ORDER BY e."weekDate" DESC OFFSET $`+strconv.Itoa(len(args)-1)+` LIMIT $`+strconv.Itoa(len(args)), args...)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat evaluasi")
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, gid, cid string
			var wd, created, updated time.Time
			var notes *string
			var urls []string
			var submitted bool
			var submittedAt *time.Time
			var group json.RawMessage
			if err = rows.Scan(&id, &gid, &cid, &wd, &notes, &urls, &submitted, &submittedAt, &created, &updated, &group); err != nil {
				httpx.Error(w, 500, "Gagal membaca evaluasi")
				return
			}
			atts := []map[string]any{}
			aRows, aerr := db.Query(r.Context(), `SELECT a."userId", a."status"::text, a."note", u."name" FROM "EvaluationAttendance" a JOIN "User" u ON u."id"=a."userId" WHERE a."evaluationId"=$1`, id)
			if aerr == nil {
				for aRows.Next() {
					var uid, st, uname string
					var note *string
					if aRows.Scan(&uid, &st, &note, &uname) == nil {
						atts = append(atts, map[string]any{"userId": uid, "status": st, "note": note, "user": map[string]string{"name": uname}})
					}
				}
				aRows.Close()
			}
			items = append(items, map[string]any{"id": id, "groupId": gid, "createdById": cid, "weekDate": wd, "notes": notes, "photoUrls": urls, "isSubmitted": submitted, "submittedAt": submittedAt, "createdAt": created, "updatedAt": updated, "group": group, "attendances": atts})
		}
		httpx.Paginated(w, items, page, limit, total)
	}
}
func create(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in evaluationInput
		if !decode(r, &in) || in.GroupID == "" || !validAttendance(in.Attendances) {
			httpx.Error(w, 400, "Data evaluasi tidak valid")
			return
		}
		if !canPembina(r, db, in.GroupID) {
			httpx.Error(w, 403, "Hanya pembina kelompok yang bisa membuat evaluasi")
			return
		}
		wd, err := monday(in.WeekDate)
		if err != nil || wd.After(mondayNow()) {
			httpx.Error(w, 400, "Tanggal evaluasi tidak boleh setelah hari ini")
			return
		}
		c, _ := middleware.Claims(r)
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal menyimpan evaluasi")
			return
		}
		defer tx.Rollback(r.Context())
		id := uuid.NewString()
		_, err = tx.Exec(r.Context(), `INSERT INTO "WeeklyEvaluation" ("id","groupId","createdById","weekDate","notes","updatedAt") VALUES($1,$2,$3,$4,$5,NOW())`, id, in.GroupID, c.UserID, wd, in.Notes)
		if err == nil {
			for _, a := range in.Attendances {
				_, err = tx.Exec(r.Context(), `INSERT INTO "EvaluationAttendance" ("id","evaluationId","userId","status","note") VALUES($1,$2,$3,$4::"AttendanceStatus",$5)`, uuid.NewString(), id, a.UserID, a.Status, a.Note)
				if err != nil {
					break
				}
			}
		}
		if err != nil {
			if strings.Contains(err.Error(), "WeeklyEvaluation_groupId_weekDate_key") {
				httpx.Error(w, 409, "Evaluasi untuk pekan ini sudah ada")
				return
			}
			httpx.Error(w, 500, "Gagal menyimpan evaluasi")
			return
		}
		if tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal menyimpan evaluasi")
			return
		}
		detailByID(w, r, db, id, 201, "Evaluasi berhasil disimpan")
	}
}
func detail(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { detailByID(w, r, db, chi.URLParam(r, "id"), 200, "") }
}
func detailByID(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, id string, status int, message string) {
	var gid, cid string
	var wd, created, updated time.Time
	var notes *string
	var urls []string
	var submitted bool
	var submittedAt *time.Time
	err := db.QueryRow(r.Context(), `SELECT "groupId","createdById","weekDate","notes","photoUrls","isSubmitted","submittedAt","createdAt","updatedAt" FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid, &cid, &wd, &notes, &urls, &submitted, &submittedAt, &created, &updated)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "Evaluasi tidak ditemukan")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat evaluasi")
		return
	}
	if code, msg := allowedEvaluation(r, db, gid); code > 0 {
		httpx.Error(w, code, msg)
		return
	}
	rows, err := db.Query(r.Context(), `SELECT a."id",a."userId",a."status"::text,a."note",json_build_object('id',u."id",'name',u."name",'email',u."email") FROM "EvaluationAttendance" a JOIN "User" u ON u."id"=a."userId" WHERE a."evaluationId"=$1`, id)
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat kehadiran")
		return
	}
	defer rows.Close()
	as := []map[string]any{}
	for rows.Next() {
		var aid, uid, st string
		var note *string
		var u json.RawMessage
		_ = rows.Scan(&aid, &uid, &st, &note, &u)
		as = append(as, map[string]any{"id": aid, "userId": uid, "status": st, "note": note, "user": u})
	}
	var groupID, groupName string
	_ = db.QueryRow(r.Context(), `SELECT "id","name" FROM "Group" WHERE "id"=$1`, gid).Scan(&groupID, &groupName)
	httpx.Success(w, status, map[string]any{
		"id": id, "groupId": gid, "createdById": cid, "weekDate": wd, "notes": notes,
		"photoUrls": urls, "isSubmitted": submitted, "submittedAt": submittedAt,
		"createdAt": created, "updatedAt": updated, "attendances": as,
		"group": map[string]string{"id": groupID, "name": groupName},
	}, message)
}
func update(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var gid string
		err := db.QueryRow(r.Context(), `SELECT "groupId" FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "Evaluasi tidak ditemukan")
			return
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat evaluasi")
			return
		}
		if !canPembina(r, db, gid) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		var raw struct {
			Notes       *string      `json:"notes"`
			Attendances []attendance `json:"attendances"`
		}
		if !decode(r, &raw) {
			httpx.Error(w, 400, "Data evaluasi tidak valid")
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal memperbarui evaluasi")
			return
		}
		defer tx.Rollback(r.Context())
		if raw.Notes != nil {
			_, err = tx.Exec(r.Context(), `UPDATE "WeeklyEvaluation" SET "notes"=$1,"updatedAt"=NOW() WHERE "id"=$2`, raw.Notes, id)
		}
		if err == nil && raw.Attendances != nil {
			if !validAttendance(raw.Attendances) {
				httpx.Error(w, 400, "Data kehadiran tidak valid")
				return
			}
			_, err = tx.Exec(r.Context(), `DELETE FROM "EvaluationAttendance" WHERE "evaluationId"=$1`, id)
			for _, a := range raw.Attendances {
				if err == nil {
					_, err = tx.Exec(r.Context(), `INSERT INTO "EvaluationAttendance" ("id","evaluationId","userId","status","note") VALUES($1,$2,$3,$4::"AttendanceStatus",$5)`, uuid.NewString(), id, a.UserID, a.Status, a.Note)
				}
			}
		}
		if err != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal memperbarui evaluasi")
			return
		}
		detailByID(w, r, db, id, 200, "Evaluasi berhasil diperbarui")
	}
}
func remove(db *pgxpool.Pool, c config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var gid string
		var urls []string
		err := db.QueryRow(r.Context(), `SELECT "groupId", COALESCE("photoUrls",'{}') FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid, &urls)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "Evaluasi tidak ditemukan")
			return
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat evaluasi")
			return
		}
		if !canPembina(r, db, gid) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal menghapus evaluasi")
			return
		}
		defer tx.Rollback(r.Context())
		if err = revokeEvaluationPoints(tx, r, id); err != nil {
			log.Printf("hapus evaluasi poin %s: %v", id, err)
			httpx.Error(w, 500, "Gagal menghapus evaluasi")
			return
		}
		if _, err = tx.Exec(r.Context(), `DELETE FROM "WeeklyEvaluation" WHERE "id"=$1`, id); err != nil {
			log.Printf("hapus evaluasi %s: %v", id, err)
			httpx.Error(w, 500, "Gagal menghapus evaluasi")
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			httpx.Error(w, 500, "Gagal menghapus evaluasi")
			return
		}
		if s, e := storage.New(c); e == nil {
			for _, u := range urls {
				if strings.TrimSpace(u) != "" {
					s.DeleteBestEffort(r.Context(), u)
				}
			}
		}
		httpx.Success(w, 200, nil, "Evaluasi berhasil dihapus")
	}
}
func revokeEvaluationPoints(tx pgx.Tx, r *http.Request, id string) error {
	rows, err := tx.Query(r.Context(), `SELECT "userId", COALESCE(SUM("points"),0) FROM "PointLog" WHERE "refType"='EVALUATION' AND "refId"=$1 GROUP BY "userId"`, id)
	if err != nil {
		return err
	}
	type grant struct {
		uid string
		pts int
	}
	grants := []grant{}
	for rows.Next() {
		var g grant
		if err = rows.Scan(&g.uid, &g.pts); err != nil {
			rows.Close()
			return err
		}
		grants = append(grants, g)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), `DELETE FROM "PointLog" WHERE "refType"='EVALUATION' AND "refId"=$1`, id); err != nil {
		return err
	}
	for _, g := range grants {
		if g.uid == "" || g.pts == 0 {
			continue
		}
		if _, err = tx.Exec(r.Context(), `UPDATE "User" SET "totalPoints"=GREATEST("totalPoints"-$1,0),"updatedAt"=NOW() WHERE "id"=$2`, g.pts, g.uid); err != nil {
			return err
		}
	}
	return nil
}
func submit(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var gid, createdBy string
		var wd time.Time
		var submitted bool
		var urls []string
		err := db.QueryRow(r.Context(), `SELECT "groupId","createdById","weekDate","isSubmitted",COALESCE("photoUrls",'{}') FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid, &createdBy, &wd, &submitted, &urls)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "Evaluasi tidak ditemukan")
			return
		}
		if submitted {
			httpx.Error(w, 400, "Evaluasi sudah disubmit")
			return
		}
		if !canPembina(r, db, gid) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		if len(urls) == 0 {
			httpx.Error(w, 400, "Foto agenda liqo wajib diunggah")
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			httpx.Error(w, 500, "Gagal submit evaluasi")
			return
		}
		defer tx.Rollback(r.Context())
		now := time.Now()
		_, err = tx.Exec(r.Context(), `UPDATE "WeeklyEvaluation" SET "isSubmitted"=true,"submittedAt"=$1,"updatedAt"=NOW() WHERE "id"=$2`, now, id)
		points := constants.PointPembinaSubmitEvaluation
		if !submitOnTime(wd, now) {
			points = constants.PointPembinaSubmitEvaluationLate
		}
		if err == nil {
			err = award(tx, r, createdBy, points, map[bool]string{true: "Submit evaluasi tepat waktu", false: "Submit evaluasi terlambat"}[points == 10], "EVALUATION", id)
		}
		var hadirUIDs []string
		rows, er := tx.Query(r.Context(), `SELECT "userId" FROM "EvaluationAttendance" WHERE "evaluationId"=$1 AND "status"='HADIR'`, id)
		if er != nil {
			err = er
		} else {
			for rows.Next() {
				var uid string
				if scanErr := rows.Scan(&uid); scanErr != nil {
					err = scanErr
					break
				}
				hadirUIDs = append(hadirUIDs, uid)
			}
			rows.Close()
			if err == nil {
				err = rows.Err()
			}
		}
		for _, uid := range hadirUIDs {
			if err != nil {
				break
			}
			err = award(tx, r, uid, constants.PointAnggotaHadirPembinaan, "Hadir pembinaan mingguan", "EVALUATION", id)
		}
		if err != nil {
			log.Printf("submit evaluasi %s: %v", id, err)
			httpx.Error(w, 500, "Gagal submit evaluasi")
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			log.Printf("submit evaluasi commit %s: %v", id, err)
			httpx.Error(w, 500, "Gagal submit evaluasi")
			return
		}
		ref := id
		pembinaDesc := map[bool]string{true: "Submit evaluasi tepat waktu", false: "Submit evaluasi terlambat"}[points == constants.PointPembinaSubmitEvaluation]
		notify.PointEarned(r.Context(), db, createdBy, points, pembinaDesc, &ref)
		for _, uid := range hadirUIDs {
			notify.PointEarned(r.Context(), db, uid, constants.PointAnggotaHadirPembinaan, "Hadir pembinaan mingguan", &ref)
		}
		detailByID(w, r, db, id, 200, "Evaluasi berhasil disubmit")
	}
}
func award(tx pgx.Tx, r *http.Request, uid string, points int, desc, typ, ref string) error {
	if uid == "" {
		return nil
	}
	var eligible bool
	if err := tx.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM "UserRole"
			WHERE "userId"=$1 AND "role" IN ('PEMBINA'::"Role",'ANGGOTA'::"Role")
		)`, uid).Scan(&eligible); err != nil {
		return err
	}
	if !eligible {
		return nil
	}
	_, err := tx.Exec(r.Context(), `INSERT INTO "PointLog" ("id","userId","points","description","refType","refId") VALUES($1,$2,$3,$4,$5,$6)`, uuid.NewString(), uid, points, desc, typ, ref)
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE "User" SET "totalPoints"="totalPoints"+$1,"updatedAt"=NOW() WHERE "id"=$2`, points, uid)
	}
	return err
}
func photos(db *pgxpool.Pool, c config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var gid string
		if err := db.QueryRow(r.Context(), `SELECT "groupId" FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid); err != nil {
			if err == pgx.ErrNoRows {
				httpx.Error(w, 404, "Evaluasi tidak ditemukan")
				return
			}
			httpx.Error(w, 500, "Gagal memuat evaluasi")
			return
		}
		if !canPembina(r, db, gid) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		if err := r.ParseMultipartForm(26 << 20); err != nil {
			httpx.Error(w, 400, "Upload foto tidak valid")
			return
		}
		files := append([]*multipart.FileHeader{}, r.MultipartForm.File["photo"]...)
		files = append(files, r.MultipartForm.File["photos"]...)
		if len(files) != 1 {
			httpx.Error(w, 400, "Unggah tepat 1 foto agenda liqo")
			return
		}
		s, err := storage.New(c)
		if err != nil {
			httpx.Error(w, 500, "Storage tidak tersedia")
			return
		}
		u, e := putImage(r, s, files[0], storage.PrefixEvaluations)
		if e != nil {
			httpx.Error(w, 400, e.Error())
			return
		}
		var old []string
		_ = db.QueryRow(r.Context(), `SELECT COALESCE("photoUrls",'{}') FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&old)
		if _, err = db.Exec(r.Context(), `UPDATE "WeeklyEvaluation" SET "photoUrls"=$1,"updatedAt"=NOW() WHERE "id"=$2`, []string{u}, id); err != nil {
			s.DeleteBestEffort(r.Context(), u)
			httpx.Error(w, 500, "Gagal upload foto")
			return
		}
		for _, prev := range old {
			if prev != u {
				s.DeleteBestEffort(r.Context(), prev)
			}
		}
		detailByID(w, r, db, id, 200, "Foto berhasil diupload")
	}
}

func canManageSchool(r *http.Request, db *pgxpool.Pool, schoolID string) bool {
	c, _ := middleware.Claims(r)
	if has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") {
		return true
	}
	if !has(c.Roles, "PJ_SEKOLAH") {
		return false
	}
	var n int
	_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "UserSchool" WHERE "schoolId"=$1 AND "userId"=$2`, schoolID, c.UserID).Scan(&n)
	return n > 0
}

func laporan(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		schoolID := strings.TrimSpace(r.URL.Query().Get("schoolId"))
		if schoolID == "" {
			httpx.Error(w, 400, "PGM wajib dipilih")
			return
		}
		if !canManageSchool(r, db, schoolID) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		wd, err := monday(r.URL.Query().Get("weekDate"))
		if err != nil {
			httpx.Error(w, 400, "weekDate tidak valid")
			return
		}
		var schoolName string
		err = db.QueryRow(r.Context(), `SELECT "name" FROM "School" WHERE "id"=$1`, schoolID).Scan(&schoolName)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "PGM tidak ditemukan")
			return
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat laporan")
			return
		}
		rows, err := db.Query(r.Context(), `
			SELECT e."id", g."name", e."photoUrls"
			FROM "WeeklyEvaluation" e
			JOIN "Group" g ON g."id"=e."groupId"
			WHERE g."schoolId"=$1 AND e."weekDate"=$2 AND e."isSubmitted" AND coalesce(cardinality(e."photoUrls"),0) > 0
			ORDER BY g."name"`, schoolID, wd)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat laporan")
			return
		}
		defer rows.Close()
		photos := []map[string]any{}
		for rows.Next() {
			var id, name string
			var urls []string
			if err = rows.Scan(&id, &name, &urls); err != nil {
				httpx.Error(w, 500, "Gagal membaca laporan")
				return
			}
			for i, u := range urls {
				if strings.TrimSpace(u) == "" {
					continue
				}
				photos = append(photos, map[string]any{"evaluationId": id, "groupName": name, "index": i})
			}
		}
		if err = rows.Err(); err != nil {
			httpx.Error(w, 500, "Gagal membaca laporan")
			return
		}
		missing := []string{}
		mRows, err := db.Query(r.Context(), `
			SELECT g."name"
			FROM "WeeklyEvaluation" e
			JOIN "Group" g ON g."id"=e."groupId"
			WHERE g."schoolId"=$1 AND e."weekDate"=$2 AND e."isSubmitted" AND coalesce(cardinality(e."photoUrls"),0)=0
			ORDER BY g."name"`, schoolID, wd)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat laporan")
			return
		}
		defer mRows.Close()
		for mRows.Next() {
			var name string
			if mRows.Scan(&name) == nil {
				missing = append(missing, name)
			}
		}
		if err = mRows.Err(); err != nil {
			httpx.Error(w, 500, "Gagal membaca laporan")
			return
		}
		pending := []string{}
		pRows, err := db.Query(r.Context(), `
			SELECT g."name"
			FROM "Group" g
			WHERE g."schoolId"=$1 AND g."isActive" AND NOT EXISTS (
				SELECT 1 FROM "WeeklyEvaluation" e
				WHERE e."groupId"=g."id" AND e."weekDate"=$2 AND e."isSubmitted"
			)
			ORDER BY g."name"`, schoolID, wd)
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat laporan")
			return
		}
		defer pRows.Close()
		for pRows.Next() {
			var name string
			if pRows.Scan(&name) == nil {
				pending = append(pending, name)
			}
		}
		if err = pRows.Err(); err != nil {
			httpx.Error(w, 500, "Gagal membaca laporan")
			return
		}
		httpx.Success(w, 200, map[string]any{
			"school":        map[string]string{"id": schoolID, "name": schoolName},
			"weekDate":      wd,
			"photos":        photos,
			"missingPhotos": missing,
			"pendingGroups": pending,
		}, "")
	}
}

func agendaPhoto(db *pgxpool.Pool, c config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var gid string
		var urls []string
		err := db.QueryRow(r.Context(), `SELECT "groupId",COALESCE("photoUrls",'{}') FROM "WeeklyEvaluation" WHERE "id"=$1`, id).Scan(&gid, &urls)
		if err == pgx.ErrNoRows {
			httpx.Error(w, 404, "Evaluasi tidak ditemukan")
			return
		}
		if err != nil {
			httpx.Error(w, 500, "Gagal memuat foto")
			return
		}
		if code, msg := allowedEvaluation(r, db, gid); code > 0 {
			httpx.Error(w, code, msg)
			return
		}
		idx := 0
		if raw := r.URL.Query().Get("index"); raw != "" {
			n, conv := strconv.Atoi(raw)
			if conv != nil || n < 0 {
				httpx.Error(w, 400, "Index foto tidak valid")
				return
			}
			idx = n
		}
		if idx >= len(urls) || strings.TrimSpace(urls[idx]) == "" {
			httpx.Error(w, 404, "Foto tidak ditemukan")
			return
		}
		s, err := storage.New(c)
		if err != nil {
			httpx.Error(w, 500, "Storage tidak tersedia")
			return
		}
		body, ct, err := s.Open(r.Context(), urls[idx])
		if err != nil {
			if os.IsNotExist(err) {
				httpx.Error(w, 404, "Foto tidak ditemukan")
				return
			}
			httpx.Error(w, 500, "Gagal memuat foto")
			return
		}
		defer body.Close()
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "private, max-age=300")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = io.Copy(w, body)
	}
}
func putImage(r *http.Request, s *storage.Storage, f *multipart.FileHeader, prefix string) (string, error) {
	in, e := f.Open()
	if e != nil {
		return "", e
	}
	defer in.Close()
	validated, _, e := storage.ValidateImage(in, f.Size)
	if e != nil {
		return "", e
	}
	optimized, ct, e := storage.OptimizeImage(validated)
	if e != nil {
		return "", e
	}
	return s.Put(r.Context(), prefix, "photo.jpg", optimized, ct)
}
func mondayNow() time.Time {
	n := time.Now().In(time.FixedZone("WIB", 7*3600))
	return n.AddDate(0, 0, -(int(n.Weekday())+6)%7).Truncate(24 * time.Hour)
}
func submitOnTime(wd, at time.Time) bool {
	return !at.In(time.FixedZone("WIB", 7*3600)).After(wd.In(time.FixedZone("WIB", 7*3600)).AddDate(0, 0, 7).Add(-time.Millisecond))
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
