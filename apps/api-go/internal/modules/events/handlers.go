package events

import (
	"encoding/json"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type eventInput struct {
	Title        string   `json:"title"`
	Description  *string  `json:"description"`
	Location     *string  `json:"location"`
	StartAt      string   `json:"startAt"`
	EndAt        string   `json:"endAt"`
	PointValue   int      `json:"pointValue"`
	ImageURL     *string  `json:"imageUrl"`
	SchoolID     *string  `json:"schoolId"`
	TargetLevels []string `json:"targetLevels"`
	IsPublished  *bool    `json:"isPublished"`
}

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.Get("/", list(db))
	r.Get("/check-ins/pending", pending(db))
	r.Post("/", save(db, c, false))
	r.Post("/check-ins/{attendanceId}/approve", approve(db))
	r.Post("/check-ins/{attendanceId}/reject", reject(db))
	r.Get("/{id}", detail(db))
	r.Put("/{id}", save(db, c, true))
	r.Delete("/{id}", remove(db, c))
	r.Post("/{id}/check-in", checkin(db, c))
	return r
}
func role(rs []string, v string) bool {
	for _, r := range rs {
		if r == v {
			return true
		}
	}
	return false
}
func admin(rs []string) bool { return role(rs, "ADMIN") || role(rs, "SUPERADMIN") }
func authorize(w http.ResponseWriter, r *http.Request, rs ...string) bool {
	c, _ := middleware.Claims(r)
	for _, x := range rs {
		if role(c.Roles, x) {
			return true
		}
	}
	httpx.Error(w, 403, "Akses ditolak")
	return false
}
func levels(v any) []string {
	out := []string{}
	add := func(x string) {
		if x == "LEVEL_1" || x == "LEVEL_2" {
			out = append(out, x)
		}
	}
	switch x := v.(type) {
	case []string:
		for _, s := range x {
			add(s)
		}
	case string:
		if x != "all" && x != "" {
			var a []string
			if json.Unmarshal([]byte(x), &a) == nil {
				for _, s := range a {
					add(s)
				}
			} else {
				add(x)
			}
		}
	}
	return out
}
func multipartEvent(r *http.Request) (eventInput, *multipart.FileHeader, error) {
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
		if e := r.ParseMultipartForm(12 << 20); e != nil {
			return eventInput{}, nil, e
		}
		in := eventInput{Title: r.FormValue("title"), Description: nil, Location: nil, StartAt: r.FormValue("startAt"), EndAt: r.FormValue("endAt"), ImageURL: nil, SchoolID: nil, TargetLevels: levels(r.FormValue("targetLevels"))}
		if v := r.FormValue("description"); v != "" {
			in.Description = &v
		}
		if v := r.FormValue("location"); v != "" {
			in.Location = &v
		}
		if v := r.FormValue("imageUrl"); v != "" {
			in.ImageURL = &v
		}
		if v := r.FormValue("schoolId"); v != "" && v != "all" {
			in.SchoolID = &v
		}
		in.PointValue, _ = strconv.Atoi(r.FormValue("pointValue"))
		if v := r.FormValue("isPublished"); v != "" {
			b := v == "true"
			in.IsPublished = &b
		}
		var image *multipart.FileHeader
		if images := r.MultipartForm.File["image"]; len(images) > 0 {
			image = images[0]
		}
		return in, image, nil
	}
	var in eventInput
	e := json.NewDecoder(r.Body).Decode(&in)
	return in, nil, e
}
func validate(in eventInput) (time.Time, time.Time, string) {
	if len(strings.TrimSpace(in.Title)) < 2 {
		return time.Time{}, time.Time{}, "Judul minimal 2 karakter"
	}
	if in.PointValue < 0 {
		return time.Time{}, time.Time{}, "Poin tidak valid"
	}
	a, e := time.Parse(time.RFC3339, in.StartAt)
	if e != nil {
		return a, time.Time{}, "startAt tidak valid"
	}
	b, e := time.Parse(time.RFC3339, in.EndAt)
	if e != nil || !b.After(a) {
		return a, b, "endAt harus setelah startAt"
	}
	for _, v := range in.TargetLevels {
		if v != "LEVEL_1" && v != "LEVEL_2" {
			return a, b, "targetLevels tidak valid"
		}
	}
	return a, b, ""
}
func save(db *pgxpool.Pool, cfg config.Config, isUpdate bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "ADMIN", "SUPERADMIN", "PJ_SEKOLAH") {
			return
		}
		in, file, e := multipartEvent(r)
		if e != nil {
			httpx.Error(w, 400, "Data event tidak valid")
			return
		}
		start, end, msg := validate(in)
		if msg != "" {
			httpx.Error(w, 400, msg)
			return
		}
		claims, _ := middleware.Claims(r)
		school := in.SchoolID
		if role(claims.Roles, "PJ_SEKOLAH") && !admin(claims.Roles) {
			var sid string
			e = db.QueryRow(r.Context(), `SELECT "schoolId" FROM "UserSchool" WHERE "userId"=$1 LIMIT 1`, claims.UserID).Scan(&sid)
			if e != nil {
				httpx.Error(w, 400, "PJ belum terhubung ke sekolah")
				return
			}
			school = &sid
		}
		id := chi.URLParam(r, "id")
		var existingImage *string
		if isUpdate {
			var own *string
			e = db.QueryRow(r.Context(), `SELECT "schoolId","imageUrl" FROM "Event" WHERE "id"=$1`, id).Scan(&own, &existingImage)
			if e == pgx.ErrNoRows {
				httpx.Error(w, 404, "Event tidak ditemukan")
				return
			}
			if e != nil {
				httpx.Error(w, 500, "Gagal memuat event")
				return
			}
			if role(claims.Roles, "PJ_SEKOLAH") && !admin(claims.Roles) {
				var n int
				_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2`, claims.UserID, own).Scan(&n)
				if own == nil || n == 0 {
					httpx.Error(w, 403, "Akses ditolak")
					return
				}
			}
		}
		var store *storage.Storage
		var newImageURL string
		if file != nil {
			store, e = storage.New(cfg)
			if e != nil {
				httpx.Error(w, 500, "Storage tidak tersedia")
				return
			}
			u, e := putImage(r, store, file, storage.PrefixEvents)
			if e != nil {
				httpx.Error(w, 400, e.Error())
				return
			}
			newImageURL = u
			in.ImageURL = &u
		} else if isUpdate && in.ImageURL == nil {
			in.ImageURL = existingImage
		}
		published := true
		if in.IsPublished != nil {
			published = *in.IsPublished
		}
		if !isUpdate {
			id = uuid.NewString()
			_, e = db.Exec(r.Context(), `INSERT INTO "Event" ("id","title","description","location","startAt","endAt","pointValue","imageUrl","schoolId","targetLevels","isPublished","createdById","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::"GroupLevel"[],$11,$12,NOW())`, id, in.Title, in.Description, in.Location, start, end, in.PointValue, in.ImageURL, school, in.TargetLevels, published, claims.UserID)
		} else {
			_, e = db.Exec(r.Context(), `UPDATE "Event" SET "title"=$1,"description"=$2,"location"=$3,"startAt"=$4,"endAt"=$5,"pointValue"=$6,"imageUrl"=$7,"targetLevels"=$8::"GroupLevel"[],"isPublished"=$9,"updatedAt"=NOW() WHERE "id"=$10`, in.Title, in.Description, in.Location, start, end, in.PointValue, in.ImageURL, in.TargetLevels, published, id)
		}
		if e != nil {
			if store != nil && newImageURL != "" {
				store.DeleteBestEffort(r.Context(), newImageURL)
			}
			httpx.Error(w, 500, "Gagal menyimpan event")
			return
		}
		if store != nil && newImageURL != "" && existingImage != nil && *existingImage != "" && *existingImage != newImageURL {
			store.DeleteBestEffort(r.Context(), *existingImage)
		}
		eventByID(w, r, db, id, map[bool]int{true: 200, false: 201}[isUpdate], map[bool]string{true: "Event berhasil diperbarui", false: "Event berhasil dibuat"}[isUpdate])
	}
}
func visibility(db *pgxpool.Pool, r *http.Request) (string, []any) {
	c, _ := middleware.Claims(r)
	base := `e."isPublished"=true AND e."endAt">=NOW()`
	if admin(c.Roles) {
		return base, nil
	}
	var schools, lev []string
	if role(c.Roles, "PJ_SEKOLAH") {
		rows, _ := db.Query(r.Context(), `SELECT "schoolId" FROM "UserSchool" WHERE "userId"=$1`, c.UserID)
		for rows.Next() {
			var x string
			_ = rows.Scan(&x)
			schools = append(schools, x)
		}
		rows.Close()
		rows, _ = db.Query(r.Context(), `SELECT DISTINCT g."level"::text FROM "Group" g JOIN "UserSchool" us ON us."schoolId"=g."schoolId" WHERE us."userId"=$1 AND g."isActive"=true`, c.UserID)
		for rows.Next() {
			var x string
			_ = rows.Scan(&x)
			lev = append(lev, x)
		}
		rows.Close()
	} else if role(c.Roles, "PEMBINA") {
		rows, _ := db.Query(r.Context(), `SELECT DISTINCT "schoolId","level"::text FROM "Group" WHERE "pembinaId"=$1 AND "isActive"=true`, c.UserID)
		for rows.Next() {
			var a, b string
			_ = rows.Scan(&a, &b)
			schools = append(schools, a)
			lev = append(lev, b)
		}
		rows.Close()
	} else {
		rows, _ := db.Query(r.Context(), `SELECT DISTINCT g."schoolId",g."level"::text FROM "GroupMember" m JOIN "Group" g ON g."id"=m."groupId" WHERE m."userId"=$1 AND m."isActive"=true AND g."isActive"=true`, c.UserID)
		for rows.Next() {
			var a, b string
			_ = rows.Scan(&a, &b)
			schools = append(schools, a)
			lev = append(lev, b)
		}
		rows.Close()
	}
	args := []any{schools, lev}
	return base + ` AND (e."schoolId" IS NULL OR e."schoolId"=ANY($1)) AND (cardinality(e."targetLevels")=0 OR e."targetLevels" && $2::"GroupLevel"[])`, args
}
func list(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, l := page(r.URL.Query().Get("page"), r.URL.Query().Get("limit"))
		where, args := visibility(db, r)
		var total int
		if e := db.QueryRow(r.Context(), `SELECT count(*) FROM "Event" e WHERE `+where, args...).Scan(&total); e != nil {
			httpx.Error(w, 500, "Gagal memuat event")
			return
		}
		c, _ := middleware.Claims(r)
		userIdx := len(args) + 1
		args = append(args, c.UserID)
		offIdx := len(args) + 1
		args = append(args, (p-1)*l)
		limIdx := len(args) + 1
		args = append(args, l)
		rows, e := db.Query(r.Context(), `SELECT e."id",e."title",e."description",e."location",e."startAt",e."endAt",e."pointValue",e."imageUrl",e."schoolId",e."targetLevels",e."isPublished",COALESCE(json_build_object('id',s."id",'name',s."name"),'null'::json),COALESCE((SELECT json_build_object('id',a."id",'status',a."status"::text,'checkedAt',a."checkedAt",'photoUrl',a."photoUrl") FROM "EventAttendance" a WHERE a."eventId"=e."id" AND a."userId"=$`+strconv.Itoa(userIdx)+`),'null'::json) FROM "Event" e LEFT JOIN "School" s ON s."id"=e."schoolId" WHERE `+where+` ORDER BY e."startAt" ASC OFFSET $`+strconv.Itoa(offIdx)+` LIMIT $`+strconv.Itoa(limIdx), args...)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat event")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, t string
			var d, loc, img, sid *string
			var a, b time.Time
			var pv int
			var ls []string
			var pub bool
			var school, check json.RawMessage
			_ = rows.Scan(&id, &t, &d, &loc, &a, &b, &pv, &img, &sid, &ls, &pub, &school, &check)
			out = append(out, map[string]any{"id": id, "title": t, "description": d, "location": loc, "startAt": a, "endAt": b, "pointValue": pv, "imageUrl": img, "schoolId": sid, "targetLevels": ls, "isPublished": pub, "school": school, "myCheckIn": check})
		}
		httpx.Paginated(w, out, p, l, total)
	}
}
func eventByID(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, id string, status int, message string) {
	var data json.RawMessage
	e := db.QueryRow(r.Context(), `SELECT row_to_json(e) FROM "Event" e WHERE e."id"=$1`, id).Scan(&data)
	if e == pgx.ErrNoRows {
		httpx.Error(w, 404, "Event tidak ditemukan")
		return
	}
	if e != nil {
		httpx.Error(w, 500, "Gagal memuat event")
		return
	}
	httpx.Success(w, status, data, message)
}
func detail(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		c, _ := middleware.Claims(r)
		where, args := visibility(db, r)
		args = append(args, c.UserID, id)
		var data json.RawMessage
		e := db.QueryRow(r.Context(), `SELECT json_build_object('id',e."id",'title',e."title",'description',e."description",'location',e."location",'startAt',e."startAt",'endAt',e."endAt",'pointValue',e."pointValue",'imageUrl',e."imageUrl",'schoolId',e."schoolId",'targetLevels',e."targetLevels",'isPublished',e."isPublished",'myCheckIn',COALESCE((SELECT json_build_object('id',a."id",'status',a."status"::text,'checkedAt',a."checkedAt",'photoUrl',a."photoUrl",'approvedAt',a."approvedAt",'rejectionNote',a."rejectionNote") FROM "EventAttendance" a WHERE a."eventId"=e."id" AND a."userId"=$`+strconv.Itoa(len(args)-1)+`),'null'::json),'isOngoing',(NOW() BETWEEN e."startAt" AND e."endAt"),'hasEnded',(NOW()>e."endAt"),'hasStarted',(NOW()>=e."startAt")) FROM "Event" e WHERE e."id"=$`+strconv.Itoa(len(args))+` AND `+where, args...).Scan(&data)
		if e == pgx.ErrNoRows {
			httpx.Error(w, 404, "Event tidak ditemukan")
			return
		}
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat event")
			return
		}
		httpx.Success(w, 200, data, "")
	}
}
func pending(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "PEMBINA") {
			return
		}
		c, _ := middleware.Claims(r)
		rows, e := db.Query(r.Context(), `
			SELECT a."id", a."eventId", a."userId", a."groupId", a."photoUrl", a."checkedAt", a."status"::text,
			       u."name", u."email",
			       e."title", e."startAt", e."endAt", e."pointValue", e."location",
			       g."name"
			FROM "EventAttendance" a
			JOIN "Group" g ON g."id"=a."groupId"
			JOIN "User" u ON u."id"=a."userId"
			JOIN "Event" e ON e."id"=a."eventId"
			WHERE g."pembinaId"=$1 AND a."status"='PENDING'
			ORDER BY a."checkedAt"`, c.UserID)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat check-in")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, eid, uid, gid, url, status, uname, uemail, title, gname string
			var startAt, endAt, checkedAt time.Time
			var pts int
			var location *string
			if rows.Scan(&id, &eid, &uid, &gid, &url, &checkedAt, &status, &uname, &uemail, &title, &startAt, &endAt, &pts, &location, &gname) != nil {
				continue
			}
			out = append(out, map[string]any{
				"id": id, "eventId": eid, "userId": uid, "groupId": gid,
				"photoUrl": url, "checkedAt": checkedAt, "status": status,
				"user":  map[string]any{"id": uid, "name": uname, "email": uemail},
				"event": map[string]any{"id": eid, "title": title, "startAt": startAt, "endAt": endAt, "pointValue": pts, "location": location},
				"group": map[string]any{"id": gid, "name": gname},
			})
		}
		httpx.Success(w, 200, out, "")
	}
}
func approve(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "PEMBINA") {
			return
		}
		id := chi.URLParam(r, "attendanceId")
		c, _ := middleware.Claims(r)
		tx, e := db.Begin(r.Context())
		if e != nil {
			httpx.Error(w, 500, "Gagal memproses check-in")
			return
		}
		defer tx.Rollback(r.Context())
		var uid, gid, title string
		var pts int
		e = tx.QueryRow(r.Context(), `SELECT a."userId",a."groupId",e."title",e."pointValue" FROM "EventAttendance" a JOIN "Event" e ON e."id"=a."eventId" WHERE a."id"=$1 AND a."status"='PENDING' FOR UPDATE`, id).Scan(&uid, &gid, &title, &pts)
		if e != nil {
			httpx.Error(w, 400, "Check-in tidak ditemukan atau sudah diproses")
			return
		}
		var n int
		_ = tx.QueryRow(r.Context(), `SELECT count(*) FROM "Group" WHERE "id"=$1 AND "pembinaId"=$2`, gid, c.UserID).Scan(&n)
		if n == 0 {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		_, e = tx.Exec(r.Context(), `UPDATE "EventAttendance" SET "status"='APPROVED',"approvedById"=$1,"approvedAt"=NOW() WHERE "id"=$2`, c.UserID, id)
		if e == nil && pts > 0 {
			_, e = tx.Exec(r.Context(), `UPDATE "User" SET "totalPoints"="totalPoints"+$1 WHERE "id"=$2`, pts, uid)
			if e == nil {
				_, e = tx.Exec(r.Context(), `INSERT INTO "PointLog" ("id","userId","points","description","refType","refId") VALUES($1,$2,$3,$4,'EVENT_CHECKIN',$5)`, uuid.NewString(), uid, pts, "Check-in event: "+title, id)
			}
		}
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal memproses check-in")
			return
		}
		httpx.Success(w, 200, map[string]any{"id": id, "status": "APPROVED"}, "Check-in disetujui")
	}
}
func reject(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "PEMBINA") {
			return
		}
		id := chi.URLParam(r, "attendanceId")
		c, _ := middleware.Claims(r)
		var in struct {
			RejectionNote *string `json:"rejectionNote"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		var gid string
		e := db.QueryRow(r.Context(), `SELECT "groupId" FROM "EventAttendance" WHERE "id"=$1 AND "status"='PENDING'`, id).Scan(&gid)
		if e != nil {
			httpx.Error(w, 400, "Check-in tidak ditemukan atau sudah diproses")
			return
		}
		var n int
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "Group" WHERE "id"=$1 AND "pembinaId"=$2`, gid, c.UserID).Scan(&n)
		if n == 0 {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		_, e = db.Exec(r.Context(), `UPDATE "EventAttendance" SET "status"='REJECTED',"approvedById"=$1,"approvedAt"=NOW(),"rejectionNote"=$2 WHERE "id"=$3`, c.UserID, in.RejectionNote, id)
		if e != nil {
			httpx.Error(w, 500, "Gagal menolak check-in")
			return
		}
		httpx.Success(w, 200, map[string]any{"id": id, "status": "REJECTED"}, "Check-in ditolak")
	}
}
func remove(db *pgxpool.Pool, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "ADMIN", "SUPERADMIN", "PJ_SEKOLAH") {
			return
		}
		id := chi.URLParam(r, "id")
		var imageURL *string
		_ = db.QueryRow(r.Context(), `SELECT "imageUrl" FROM "Event" WHERE "id"=$1`, id).Scan(&imageURL)
		rows, qe := db.Query(r.Context(), `SELECT "photoUrl" FROM "EventAttendance" WHERE "eventId"=$1`, id)
		photoURLs := []string{}
		if qe == nil {
			defer rows.Close()
			for rows.Next() {
				var u string
				if rows.Scan(&u) == nil && u != "" {
					photoURLs = append(photoURLs, u)
				}
			}
		}
		_, e := db.Exec(r.Context(), `DELETE FROM "Event" WHERE "id"=$1`, id)
		if e != nil {
			httpx.Error(w, 500, "Gagal menghapus event")
			return
		}
		if s, se := storage.New(cfg); se == nil {
			if imageURL != nil {
				s.DeleteBestEffort(r.Context(), *imageURL)
			}
			for _, u := range photoURLs {
				s.DeleteBestEffort(r.Context(), u)
			}
		}
		httpx.Success(w, 200, nil, "Event berhasil dihapus")
	}
}
func checkin(db *pgxpool.Pool, cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !authorize(w, r, "ANGGOTA") {
			return
		}
		if e := r.ParseMultipartForm(7 << 20); e != nil {
			httpx.Error(w, 400, "Upload foto tidak valid")
			return
		}
		fs := r.MultipartForm.File["photo"]
		if len(fs) != 1 {
			httpx.Error(w, 400, "Foto check-in wajib diunggah")
			return
		}
		id := chi.URLParam(r, "id")
		c, _ := middleware.Claims(r)
		var gid string
		e := db.QueryRow(r.Context(), `SELECT g."id" FROM "GroupMember" m JOIN "Group" g ON g."id"=m."groupId" WHERE m."userId"=$1 AND m."isActive"=true AND g."isActive"=true LIMIT 1`, c.UserID).Scan(&gid)
		if e != nil {
			httpx.Error(w, 400, "Kelompok tidak ditemukan")
			return
		}
		var oldPhoto *string
		_ = db.QueryRow(r.Context(), `SELECT "photoUrl" FROM "EventAttendance" WHERE "eventId"=$1 AND "userId"=$2 AND "status"='REJECTED'`, id, c.UserID).Scan(&oldPhoto)
		s, e := storage.New(cfg)
		if e != nil {
			httpx.Error(w, 500, "Storage tidak tersedia")
			return
		}
		url, e := putImage(r, s, fs[0], storage.PrefixCheckins)
		if e != nil {
			httpx.Error(w, 400, e.Error())
			return
		}
		_, e = db.Exec(r.Context(), `INSERT INTO "EventAttendance" ("id","eventId","userId","groupId","photoUrl","status") VALUES($1,$2,$3,$4,$5,'PENDING') ON CONFLICT ("eventId","userId") DO UPDATE SET "groupId"=EXCLUDED."groupId","photoUrl"=EXCLUDED."photoUrl","status"='PENDING',"checkedAt"=NOW(),"approvedById"=NULL,"approvedAt"=NULL,"rejectionNote"=NULL WHERE "EventAttendance"."status"='REJECTED'`, uuid.NewString(), id, c.UserID, gid, url)
		if e != nil {
			s.DeleteBestEffort(r.Context(), url)
			httpx.Error(w, 400, "Anda sudah check-in event ini")
			return
		}
		if oldPhoto != nil && *oldPhoto != "" && *oldPhoto != url {
			s.DeleteBestEffort(r.Context(), *oldPhoto)
		}
		httpx.Success(w, 201, map[string]any{"eventId": id, "status": "PENDING", "photoUrl": url}, "Check-in terkirim, menunggu persetujuan pembina")
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
