package mutabaah

import (
	"encoding/json"
	"net/http"
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
	r.Get("/items", items(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Post("/items", createItem(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Put("/items/{id}", updateItem(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Delete("/items/{id}", removeItem(db))
	r.With(middleware.RequireRole("ANGGOTA")).Get("/my", mine(db))
	r.With(middleware.RequireRole("ANGGOTA")).Put("/my", save(db, false))
	r.With(middleware.RequireRole("ANGGOTA")).Post("/my/submit", save(db, true))
	r.Get("/member/{userId}", member(db))
	r.Get("/group/{groupId}", group(db))
	return r
}
func has(a []string, v string) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}
func monday(raw string) (time.Time, error) {
	if raw == "" {
		raw = time.Now().Format("2006-01-02")
	}
	t, e := time.ParseInLocation("2006-01-02", raw[:min(len(raw), 10)], time.FixedZone("WIB", 7*3600))
	if e != nil {
		return time.Time{}, e
	}
	return t.AddDate(0, 0, -(int(t.Weekday())+6)%7), nil
}
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func emptyMutabaahValue(fieldType, inputScope string) any {
	if inputScope == "DAILY" {
		if fieldType == "NUMBER" {
			return map[string]any{"days": []any{0, 0, 0, 0, 0, 0, 0}}
		}
		return map[string]any{"days": []any{false, false, false, false, false, false, false}}
	}
	switch fieldType {
	case "CHECKBOX":
		return map[string]any{"checked": false}
	case "NUMBER":
		return map[string]any{"value": 0}
	case "SELECT":
		return map[string]any{"value": "", "otherText": ""}
	default:
		return map[string]any{"text": ""}
	}
}

func coalesceMutabaahValue(fieldType, inputScope string, val json.RawMessage) any {
	if len(val) == 0 || string(val) == "null" {
		return emptyMutabaahValue(fieldType, inputScope)
	}
	var parsed any
	if err := json.Unmarshal(val, &parsed); err != nil || parsed == nil {
		return emptyMutabaahValue(fieldType, inputScope)
	}
	return parsed
}

func coalesceMutabaahOptions(opt json.RawMessage) any {
	if len(opt) == 0 || string(opt) == "null" {
		return []any{}
	}
	var parsed any
	if err := json.Unmarshal(opt, &parsed); err != nil || parsed == nil {
		return []any{}
	}
	return parsed
}
func groupAccess(db *pgxpool.Pool, r *http.Request, gid string, target string) bool {
	c, _ := middleware.Claims(r)
	if has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") {
		return true
	}
	var owner, school string
	if db.QueryRow(r.Context(), `SELECT "pembinaId","schoolId" FROM "Group" WHERE "id"=$1`, gid).Scan(&owner, &school) != nil {
		return false
	}
	if has(c.Roles, "PEMBINA") {
		return owner == c.UserID
	}
	if has(c.Roles, "PJ_SEKOLAH") {
		var ok bool
		_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, school).Scan(&ok)
		return ok
	}
	return target != "" && target == c.UserID
}

type itemInput struct {
	Level, Title, Description, Target, FieldType, InputScope string
	Options                                                  json.RawMessage
	MinValue, MaxValue                                       *int
	SortOrder                                                int
	IsRequired, IsActive                                     *bool
	AllowOther                                               *bool
	OtherLabel                                               *string
}

func validItem(i itemInput) bool {
	return (i.Level == "LEVEL_1" || i.Level == "LEVEL_2") && i.Title != "" && (i.FieldType == "CHECKBOX" || i.FieldType == "NUMBER" || i.FieldType == "TEXT" || i.FieldType == "SELECT") && (i.InputScope == "" || i.InputScope == "WEEKLY" || i.InputScope == "DAILY")
}
func items(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		q := r.URL.Query()
		args := []any{}
		where := `1=1`
		if v := q.Get("level"); v != "" {
			args = append(args, v)
			where += ` AND "level"=$1::"GroupLevel"`
		}
		if !has(c.Roles, "SUPERADMIN") && !has(c.Roles, "ADMIN") {
			where += ` AND "isActive"`
		}
		rows, e := db.Query(r.Context(), `SELECT "id","level"::text,"title","description","target","fieldType"::text,"inputScope"::text,"options","minValue","maxValue","sortOrder","isRequired","isActive","allowOther","otherLabel" FROM "MutabaahItem" WHERE `+where+` ORDER BY "level","sortOrder","title"`, args...)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat poin mutabaah")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, l, t, ft, is string
			var d, tar, other *string
			var opts json.RawMessage
			var lo, hi *int
			var so int
			var req, act, allow bool
			if rows.Scan(&id, &l, &t, &d, &tar, &ft, &is, &opts, &lo, &hi, &so, &req, &act, &allow, &other) == nil {
				out = append(out, map[string]any{
					"id": id, "level": l, "title": t, "description": d, "target": tar,
					"fieldType": ft, "inputScope": is, "options": coalesceMutabaahOptions(opts),
					"minValue": lo, "maxValue": hi, "sortOrder": so, "isRequired": req,
					"isActive": act, "allowOther": allow, "otherLabel": other,
				})
			}
		}
		httpx.Success(w, 200, out, "")
	}
}
func createItem(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var i itemInput
		if json.NewDecoder(r.Body).Decode(&i) != nil || !validItem(i) {
			httpx.Error(w, 400, "Data poin mutabaah tidak valid")
			return
		}
		if i.InputScope == "" {
			i.InputScope = "WEEKLY"
		}
		id := uuid.NewString()
		_, e := db.Exec(r.Context(), `INSERT INTO "MutabaahItem" ("id","level","title","description","target","fieldType","inputScope","options","minValue","maxValue","sortOrder","isRequired","isActive","allowOther","otherLabel","updatedAt") VALUES($1,$2::"GroupLevel",$3,$4,$5,$6::"MutabaahFieldType",$7::"MutabaahInputScope",$8,$9,$10,$11,COALESCE($12,true),COALESCE($13,true),COALESCE($14,false),COALESCE($15,'Lainnya'),NOW())`, id, i.Level, i.Title, nullIfEmpty(i.Description), nullIfEmpty(i.Target), i.FieldType, i.InputScope, i.Options, i.MinValue, i.MaxValue, i.SortOrder, i.IsRequired, i.IsActive, i.AllowOther, i.OtherLabel)
		if e != nil {
			httpx.Error(w, 400, "Gagal menambahkan poin mutabaah")
			return
		}
		httpx.Success(w, 201, map[string]string{"id": id}, "Poin mutabaah berhasil ditambahkan")
	}
}
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func updateItem(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var i itemInput
		if json.NewDecoder(r.Body).Decode(&i) != nil {
			httpx.Error(w, 400, "Body tidak valid")
			return
		}
		tag, e := db.Exec(r.Context(), `UPDATE "MutabaahItem" SET "title"=COALESCE(NULLIF($1,''),"title"),"description"=COALESCE($2,"description"),"target"=COALESCE($3,"target"),"options"=COALESCE($4,"options"),"minValue"=COALESCE($5,"minValue"),"maxValue"=COALESCE($6,"maxValue"),"sortOrder"=CASE WHEN $7=0 THEN "sortOrder" ELSE $7 END,"isRequired"=COALESCE($8,"isRequired"),"isActive"=COALESCE($9,"isActive"),"allowOther"=COALESCE($10,"allowOther"),"otherLabel"=COALESCE($11,"otherLabel"),"updatedAt"=NOW() WHERE "id"=$12`, i.Title, i.Description, i.Target, i.Options, i.MinValue, i.MaxValue, i.SortOrder, i.IsRequired, i.IsActive, i.AllowOther, i.OtherLabel, chi.URLParam(r, "id"))
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Poin mutabaah tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "Poin mutabaah berhasil diperbarui")
	}
}
func removeItem(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tag, e := db.Exec(r.Context(), `UPDATE "MutabaahItem" SET "isActive"=false,"updatedAt"=NOW() WHERE "id"=$1`, chi.URLParam(r, "id"))
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Poin mutabaah tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "Poin mutabaah dinonaktifkan")
	}
}

type answer struct {
	ItemID string          `json:"itemId"`
	Value  json.RawMessage `json:"value"`
}
type entryInput struct {
	GroupID, WeekDate string
	Answers           []answer
}

func memberGroup(db *pgxpool.Pool, r *http.Request, uid, gid string) (time.Time, string, error) {
	var joined time.Time
	var level string
	e := db.QueryRow(r.Context(), `SELECT gm."joinedAt",g."level"::text FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."userId"=$1 AND gm."groupId"=$2 AND gm."isActive"`, uid, gid).Scan(&joined, &level)
	return joined, level, e
}
func save(db *pgxpool.Pool, submit bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		var in entryInput
		if json.NewDecoder(r.Body).Decode(&in) != nil || in.GroupID == "" {
			httpx.Error(w, 400, "Data mutabaah tidak valid")
			return
		}
		week, e := monday(in.WeekDate)
		if e != nil {
			httpx.Error(w, 400, "weekDate tidak valid")
			return
		}
		joined, level, e := memberGroup(db, r, c.UserID, in.GroupID)
		if e != nil {
			httpx.Error(w, 403, "Anda bukan anggota kelompok ini")
			return
		}
		jweek, _ := monday(joined.Format("2006-01-02"))
		if week.Before(jweek) {
			httpx.Error(w, 400, "Mutabaah hanya bisa diisi sejak pekan Anda bergabung ke kelompok ini")
			return
		}
		tx, e := db.Begin(r.Context())
		if e != nil {
			httpx.Error(w, 500, "Gagal menyimpan mutabaah")
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		var sent bool
		e = tx.QueryRow(r.Context(), `SELECT "id","isSubmitted" FROM "MutabaahEntry" WHERE "userId"=$1 AND "groupId"=$2 AND "weekDate"=$3`, c.UserID, in.GroupID, week).Scan(&id, &sent)
		if e == pgx.ErrNoRows {
			id = uuid.NewString()
			_, e = tx.Exec(r.Context(), `INSERT INTO "MutabaahEntry" ("id","userId","groupId","weekDate","updatedAt") VALUES($1,$2,$3,$4,NOW())`, id, c.UserID, in.GroupID, week)
		}
		if e != nil {
			httpx.Error(w, 500, "Gagal menyimpan mutabaah")
			return
		}
		if sent {
			httpx.Error(w, 400, "Mutabaah pekan ini sudah dikirim")
			return
		}
		var total, provided, required int
		_ = tx.QueryRow(r.Context(), `SELECT count(*),count(*) FILTER(WHERE "isRequired") FROM "MutabaahItem" WHERE "level"=$1::"GroupLevel" AND "isActive"`, level).Scan(&total, &required)
		for _, a := range in.Answers {
			var ok bool
			_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "MutabaahItem" WHERE "id"=$1 AND "level"=$2::"GroupLevel" AND "isActive")`, a.ItemID, level).Scan(&ok)
			if !ok {
				httpx.Error(w, 400, "Poin mutabaah tidak valid")
				return
			}
			provided++
			_, e = tx.Exec(r.Context(), `INSERT INTO "MutabaahAnswer" ("id","entryId","itemId","value") VALUES($1,$2,$3,$4) ON CONFLICT ("entryId","itemId") DO UPDATE SET "value"=EXCLUDED."value"`, uuid.NewString(), id, a.ItemID, a.Value)
			if e != nil {
				httpx.Error(w, 400, "Jawaban mutabaah tidak valid")
				return
			}
		}
		if provided < required {
			httpx.Error(w, 400, "Semua poin mutabaah wajib diisi")
			return
		}
		if submit {
			_, e = tx.Exec(r.Context(), `UPDATE "MutabaahEntry" SET "isSubmitted"=true,"submittedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1`, id)
			if e == nil && constants.IsPointEligible(c.Roles) {
				var exists bool
				_ = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "PointLog" WHERE "userId"=$1 AND "refType"='MUTABAAH' AND "refId"=$2)`, c.UserID, id).Scan(&exists)
				if !exists {
					_, e = tx.Exec(r.Context(), `INSERT INTO "PointLog" ("id","userId","points","description","refType","refId") VALUES($1,$2,$3,'Mengirim mutabaah yaumiyah','MUTABAAH',$4)`, uuid.NewString(), c.UserID, constants.PointAnggotaSubmitMutabaah, id)
					if e == nil {
						_, e = tx.Exec(r.Context(), `UPDATE "User" SET "totalPoints"="totalPoints"+$1,"updatedAt"=NOW() WHERE "id"=$2`, constants.PointAnggotaSubmitMutabaah, c.UserID)
					}
				}
			}
		}
		if e != nil || tx.Commit(r.Context()) != nil {
			httpx.Error(w, 500, "Gagal menyimpan mutabaah")
			return
		}
		entryResponse(w, r, db, c.UserID, in.GroupID, week, map[bool]string{true: "Mutabaah berhasil dikirim", false: "Mutabaah berhasil disimpan"}[submit])
	}
}
func mine(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		gid := r.URL.Query().Get("groupId")
		if gid == "" {
			rows, e := db.Query(r.Context(), `SELECT g."id",g."name",g."level"::text,gm."joinedAt" FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."userId"=$1 AND gm."isActive"`, c.UserID)
			if e != nil {
				httpx.Error(w, 500, "Gagal memuat kelompok")
				return
			}
			defer rows.Close()
			gs := []map[string]any{}
			for rows.Next() {
				var id, n, l string
				var j time.Time
				if rows.Scan(&id, &n, &l, &j) == nil {
					gs = append(gs, map[string]any{"id": id, "name": n, "level": l, "joinedAt": j})
				}
			}
			if len(gs) == 0 {
				httpx.Error(w, 404, "Anda belum terdaftar di kelompok")
				return
			}
			if len(gs) > 1 {
				httpx.Success(w, 200, map[string]any{"needsGroupSelection": true, "groups": gs}, "")
				return
			}
			gid = gs[0]["id"].(string)
		}
		week, e := monday(r.URL.Query().Get("weekDate"))
		if e != nil {
			httpx.Error(w, 400, "weekDate tidak valid")
			return
		}
		entryResponse(w, r, db, c.UserID, gid, week, "")
	}
}
func entryResponse(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, uid, gid string, week time.Time, msg string) {
	var gn, level string
	var joined time.Time
	if db.QueryRow(r.Context(), `SELECT g."name",g."level"::text,gm."joinedAt" FROM "Group" g JOIN "GroupMember" gm ON gm."groupId"=g."id" WHERE g."id"=$1 AND gm."userId"=$2 AND gm."isActive"`, gid, uid).Scan(&gn, &level, &joined) != nil {
		httpx.Error(w, 404, "Kelompok atau anggota tidak ditemukan")
		return
	}
	var id string
	var submitted bool
	var at *time.Time
	e := db.QueryRow(r.Context(), `SELECT "id","isSubmitted","submittedAt" FROM "MutabaahEntry" WHERE "userId"=$1 AND "groupId"=$2 AND "weekDate"=$3`, uid, gid, week).Scan(&id, &submitted, &at)
	if e == pgx.ErrNoRows {
		id = ""
	}
	rows, _ := db.Query(r.Context(), `SELECT i."id",i."title",i."description",i."target",i."fieldType"::text,i."inputScope"::text,i."options",i."minValue",i."maxValue",i."isRequired",i."allowOther",i."otherLabel",i."sortOrder",a."value" FROM "MutabaahItem" i LEFT JOIN "MutabaahAnswer" a ON a."itemId"=i."id" AND a."entryId"=$1 WHERE i."level"=$2::"GroupLevel" AND i."isActive" ORDER BY i."sortOrder",i."title"`, id, level)
	defer rows.Close()
	xs := []map[string]any{}
	for rows.Next() {
		var iid, t, ft, is string
		var d, tar, other *string
		var opt, val json.RawMessage
		var lo, hi *int
		var req, allow bool
		var sort int
		if rows.Scan(&iid, &t, &d, &tar, &ft, &is, &opt, &lo, &hi, &req, &allow, &other, &sort, &val) == nil {
			xs = append(xs, map[string]any{
				"id": iid, "title": t, "description": d, "target": tar,
				"fieldType": ft, "inputScope": is, "options": coalesceMutabaahOptions(opt),
				"minValue": lo, "maxValue": hi, "isRequired": req, "allowOther": allow,
				"otherLabel": other, "sortOrder": sort,
				"value": coalesceMutabaahValue(ft, is, val), "isActive": true,
			})
		}
	}
	httpx.Success(w, 200, map[string]any{"group": map[string]string{"id": gid, "name": gn, "level": level}, "weekDate": week, "minWeekDate": joined, "joinedAt": joined, "id": nullable(id), "isSubmitted": submitted, "submittedAt": at, "items": xs}, msg)
}
func nullable(v string) any {
	if v == "" {
		return nil
	}
	return v
}
func member(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, gid := chi.URLParam(r, "userId"), r.URL.Query().Get("groupId")
		if gid == "" {
			httpx.Error(w, 400, "groupId wajib diisi")
			return
		}
		if !groupAccess(db, r, gid, uid) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		week, e := monday(r.URL.Query().Get("weekDate"))
		if e != nil {
			httpx.Error(w, 400, "weekDate tidak valid")
			return
		}
		entryResponse(w, r, db, uid, gid, week, "")
	}
}
func group(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gid := chi.URLParam(r, "groupId")
		if !groupAccess(db, r, gid, "") {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		week, e := monday(r.URL.Query().Get("weekDate"))
		if e != nil {
			httpx.Error(w, 400, "weekDate tidak valid")
			return
		}
		var groupName, level string
		if e = db.QueryRow(r.Context(), `SELECT "name","level"::text FROM "Group" WHERE "id"=$1`, gid).Scan(&groupName, &level); e != nil {
			httpx.Error(w, 404, "Kelompok tidak ditemukan")
			return
		}
		itemRows, e := db.Query(r.Context(), `SELECT "id","title","description","target","fieldType"::text,"inputScope"::text,"options","minValue","maxValue","isRequired","allowOther","otherLabel","sortOrder" FROM "MutabaahItem" WHERE "level"=$1::"GroupLevel" AND "isActive" ORDER BY "sortOrder","title"`, level)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat poin mutabaah")
			return
		}
		defer itemRows.Close()
		items := []map[string]any{}
		for itemRows.Next() {
			var id, title, fieldType, inputScope string
			var description, target, otherLabel *string
			var options json.RawMessage
			var minValue, maxValue *int
			var required, allowOther bool
			var sortOrder int
			if itemRows.Scan(&id, &title, &description, &target, &fieldType, &inputScope, &options, &minValue, &maxValue, &required, &allowOther, &otherLabel, &sortOrder) == nil {
				items = append(items, map[string]any{
					"id": id, "title": title, "description": description, "target": target,
					"fieldType": fieldType, "inputScope": inputScope, "options": coalesceMutabaahOptions(options),
					"minValue": minValue, "maxValue": maxValue, "isRequired": required,
					"allowOther": allowOther, "otherLabel": otherLabel, "sortOrder": sortOrder,
				})
			}
		}
		rows, e := db.Query(r.Context(), `SELECT u."id",u."name",e."id",COALESCE(e."isSubmitted",false),e."submittedAt" FROM "GroupMember" gm JOIN "User" u ON u."id"=gm."userId" LEFT JOIN "MutabaahEntry" e ON e."userId"=u."id" AND e."groupId"=gm."groupId" AND e."weekDate"=$2 WHERE gm."groupId"=$1 AND gm."isActive" ORDER BY u."name"`, gid, week)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat anggota")
			return
		}
		defer rows.Close()
		members := []map[string]any{}
		for rows.Next() {
			var uid, name string
			var entryID *string
			var submitted bool
			var submittedAt *time.Time
			if rows.Scan(&uid, &name, &entryID, &submitted, &submittedAt) == nil {
				values := map[string]json.RawMessage{}
				if entryID != nil {
					answerRows, _ := db.Query(r.Context(), `SELECT "itemId","value" FROM "MutabaahAnswer" WHERE "entryId"=$1`, *entryID)
					for answerRows.Next() {
						var itemID string
						var value json.RawMessage
						if answerRows.Scan(&itemID, &value) == nil {
							values[itemID] = value
						}
					}
					answerRows.Close()
				}
				memberItems := make([]map[string]any, 0, len(items))
				for _, item := range items {
					copy := map[string]any{}
					for key, value := range item {
						copy[key] = value
					}
					ft, _ := item["fieldType"].(string)
					is, _ := item["inputScope"].(string)
					copy["value"] = coalesceMutabaahValue(ft, is, values[item["id"].(string)])
					memberItems = append(memberItems, copy)
				}
				members = append(members, map[string]any{"user": map[string]string{"id": uid, "name": name}, "id": entryID, "weekDate": week, "isSubmitted": submitted, "submittedAt": submittedAt, "items": memberItems})
			}
		}
		httpx.Success(w, 200, map[string]any{"group": map[string]string{"id": gid, "name": groupName, "level": level}, "weekDate": week, "members": members}, "")
	}
}
