package ic

import (
	"encoding/json"
	"net/http"

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
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Post("/items", create(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Put("/items/{id}", update(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN")).Delete("/items/{id}", remove(db))
	r.Get("/member/{userId}", member(db))
	r.With(middleware.RequireRole("PEMBINA")).Put("/member/{userId}/progress", progress(db))
	return r
}
func has(roles []string, want string) bool {
	for _, x := range roles {
		if x == want {
			return true
		}
	}
	return false
}
func admin(roles []string) bool { return has(roles, "SUPERADMIN") || has(roles, "ADMIN") }
func canGroup(db *pgxpool.Pool, r *http.Request, gid string, write bool) bool {
	c, _ := middleware.Claims(r)
	if admin(c.Roles) {
		return true
	}
	var owner, school string
	if db.QueryRow(r.Context(), `SELECT "pembinaId","schoolId" FROM "Group" WHERE "id"=$1`, gid).Scan(&owner, &school) != nil {
		return false
	}
	if has(c.Roles, "PEMBINA") {
		return owner == c.UserID
	}
	if !write && has(c.Roles, "PJ_SEKOLAH") {
		var ok bool
		_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, school).Scan(&ok)
		return ok
	}
	return false
}

type itemInput struct {
	Level, Category, Type, Title string
	Number, SortOrder            int
	Materi                       *string
	IsActive                     *bool
}

func validItem(v itemInput) bool {
	return (v.Level == "LEVEL_1" || v.Level == "LEVEL_2") && v.Title != "" && v.Number > 0 && contains(constants.ICCategories, v.Category) && contains(constants.ICTypes, v.Type)
}
func contains(a []string, v string) bool {
	for _, x := range a {
		if x == v {
			return true
		}
	}
	return false
}
func items(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		if !(admin(c.Roles) || has(c.Roles, "PJ_SEKOLAH") || has(c.Roles, "PEMBINA")) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		q := r.URL.Query()
		args := []any{}
		where := `1=1`
		for _, f := range []struct{ k, col string }{{"level", `"level"`}, {"category", `"category"`}, {"type", `"type"`}} {
			if v := q.Get(f.k); v != "" {
				args = append(args, v)
				where += ` AND ` + f.col + `=$` + num(len(args))
			}
		}
		if !admin(c.Roles) {
			where += ` AND "isActive"`
		}
		rows, e := db.Query(r.Context(), `SELECT "id","level"::text,"category"::text,"type"::text,"number","title","materi","sortOrder","isActive" FROM "IndikatorCapaian" WHERE `+where+` ORDER BY "level","category","type","sortOrder","number"`, args...)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat indikator")
			return
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, l, ca, t, ti string
			var n, s int
			var m *string
			var active bool
			if rows.Scan(&id, &l, &ca, &t, &n, &ti, &m, &s, &active) == nil {
				out = append(out, map[string]any{"id": id, "level": l, "category": ca, "type": t, "number": n, "title": ti, "materi": m, "sortOrder": s, "isActive": active})
			}
		}
		httpx.Success(w, 200, out, "")
	}
}
func create(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in itemInput
		if json.NewDecoder(r.Body).Decode(&in) != nil || !validItem(in) {
			httpx.Error(w, 400, "Data indikator tidak valid")
			return
		}
		id := uuid.NewString()
		_, e := db.Exec(r.Context(), `INSERT INTO "IndikatorCapaian" ("id","level","category","type","number","title","materi","sortOrder","updatedAt") VALUES($1,$2::"GroupLevel",$3::"ICCategory",$4::"ICType",$5,$6,$7,$8,NOW())`, id, in.Level, in.Category, in.Type, in.Number, in.Title, in.Materi, in.SortOrder)
		if e != nil {
			httpx.Error(w, 400, "Gagal menambahkan indikator")
			return
		}
		httpx.Success(w, 201, map[string]string{"id": id}, "Indikator capaian berhasil ditambahkan")
	}
}
func update(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in itemInput
		if json.NewDecoder(r.Body).Decode(&in) != nil {
			httpx.Error(w, 400, "Body tidak valid")
			return
		}
		id := chi.URLParam(r, "id")
		tag, e := db.Exec(r.Context(), `UPDATE "IndikatorCapaian" SET "title"=COALESCE(NULLIF($1,''),"title"),"materi"=COALESCE($2,"materi"),"sortOrder"=CASE WHEN $3=0 THEN "sortOrder" ELSE $3 END,"isActive"=COALESCE($4,"isActive"),"updatedAt"=NOW() WHERE "id"=$5`, in.Title, in.Materi, in.SortOrder, in.IsActive, id)
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Indikator capaian tidak ditemukan")
			return
		}
		httpx.Success(w, 200, map[string]string{"id": id}, "Indikator capaian berhasil diperbarui")
	}
}
func remove(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tag, e := db.Exec(r.Context(), `UPDATE "IndikatorCapaian" SET "isActive"=false,"updatedAt"=NOW() WHERE "id"=$1`, chi.URLParam(r, "id"))
		if e != nil || tag.RowsAffected() == 0 {
			httpx.Error(w, 404, "Indikator capaian tidak ditemukan")
			return
		}
		httpx.Success(w, 200, nil, "Indikator capaian dinonaktifkan")
	}
}
func member(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, gid := chi.URLParam(r, "userId"), r.URL.Query().Get("groupId")
		if gid == "" {
			httpx.Error(w, 400, "groupId wajib diisi")
			return
		}
		if !canGroup(db, r, gid, false) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		var uname, gn, level string
		e := db.QueryRow(r.Context(), `SELECT u."name",g."name",g."level"::text FROM "GroupMember" gm JOIN "User" u ON u."id"=gm."userId" JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."userId"=$1 AND gm."groupId"=$2 AND gm."isActive"`, uid, gid).Scan(&uname, &gn, &level)
		if e != nil {
			httpx.Error(w, 404, "Anggota tidak ditemukan di kelompok ini")
			return
		}
		rows, e := db.Query(r.Context(), `SELECT i."id",i."category"::text,i."type"::text,i."number",i."title",i."materi",i."sortOrder",COALESCE(p."isAchieved",false),p."checkedAt",checker."name" FROM "IndikatorCapaian" i LEFT JOIN "MemberICProgress" p ON p."indikatorId"=i."id" AND p."userId"=$1 AND p."groupId"=$2 LEFT JOIN "User" checker ON checker."id"=p."checkedById" WHERE i."level"=$3::"GroupLevel" AND i."isActive" ORDER BY i."category",i."type",i."sortOrder",i."number"`, uid, gid, level)
		if e != nil {
			httpx.Error(w, 500, "Gagal memuat IC")
			return
		}
		defer rows.Close()
		cats := map[string]map[string][]map[string]any{}
		total, achieved, pt, pa, st, sa := 0, 0, 0, 0, 0, 0
		for rows.Next() {
			var id, cat, typ, title string
			var num, sort int
			var materi, checker *string
			var yes bool
			var at any
			if rows.Scan(&id, &cat, &typ, &num, &title, &materi, &sort, &yes, &at, &checker) == nil {
				x := map[string]any{"id": id, "number": num, "title": title, "materi": materi, "sortOrder": sort, "isAchieved": yes, "checkedAt": at, "checkedByName": checker}
				if cats[cat] == nil {
					cats[cat] = map[string][]map[string]any{}
				}
				cats[cat][typ] = append(cats[cat][typ], x)
				total++
				if yes {
					achieved++
				}
				if typ == "PRIMER" {
					pt++
					if yes {
						pa++
					}
				} else {
					st++
					if yes {
						sa++
					}
				}
			}
		}
		out := []map[string]any{}
		for _, cat := range constants.ICCategories {
			types := []map[string]any{}
			for _, typ := range constants.ICTypes {
				if xs := cats[cat][typ]; len(xs) > 0 {
					types = append(types, map[string]any{"type": typ, "label": constants.ICTypeLabels[typ], "items": xs})
				}
			}
			if len(types) > 0 {
				out = append(out, map[string]any{"category": cat, "label": constants.ICCategoryLabels[cat], "types": types})
			}
		}
		httpx.Success(w, 200, map[string]any{"user": map[string]string{"id": uid, "name": uname}, "group": map[string]string{"id": gid, "name": gn, "level": level}, "summary": map[string]int{"total": total, "achieved": achieved, "primerTotal": pt, "primerAchieved": pa, "sekunderTotal": st, "sekunderAchieved": sa}, "categories": out}, "")
	}
}
func progress(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid := chi.URLParam(r, "userId")
		var in struct {
			GroupID, IndikatorID string
			IsAchieved           bool
		}
		if json.NewDecoder(r.Body).Decode(&in) != nil || in.GroupID == "" || in.IndikatorID == "" {
			httpx.Error(w, 400, "Data progres tidak valid")
			return
		}
		if !canGroup(db, r, in.GroupID, true) {
			httpx.Error(w, 403, "Hanya pembina kelompok yang dapat mengubah checklist IC")
			return
		}
		var level string
		if db.QueryRow(r.Context(), `SELECT "level"::text FROM "Group" WHERE "id"=$1`, in.GroupID).Scan(&level) != nil {
			httpx.Error(w, 404, "Kelompok tidak ditemukan")
			return
		}
		var ok bool
		_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "GroupMember" WHERE "groupId"=$1 AND "userId"=$2 AND "isActive") AND EXISTS(SELECT 1 FROM "IndikatorCapaian" WHERE "id"=$3 AND "level"=$4::"GroupLevel" AND "isActive")`, in.GroupID, uid, in.IndikatorID, level).Scan(&ok)
		if !ok {
			httpx.Error(w, 404, "Anggota atau indikator capaian tidak ditemukan")
			return
		}
		c, _ := middleware.Claims(r)
		_, e := db.Exec(r.Context(), `INSERT INTO "MemberICProgress" ("id","userId","groupId","indikatorId","isAchieved","checkedById") VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT ("userId","groupId","indikatorId") DO UPDATE SET "isAchieved"=EXCLUDED."isAchieved","checkedById"=EXCLUDED."checkedById","checkedAt"=NOW()`, uuid.NewString(), uid, in.GroupID, in.IndikatorID, in.IsAchieved, c.UserID)
		if e != nil {
			httpx.Error(w, 500, "Gagal memperbarui IC")
			return
		}
		httpx.Success(w, 200, map[string]any{"indikatorId": in.IndikatorID, "isAchieved": in.IsAchieved}, map[bool]string{true: "IC ditandai tercapai", false: "IC ditandai belum tercapai"}[in.IsAchieved])
	}
}
func num(n int) string { return string(rune('0' + n)) }

var _ = pgx.ErrNoRows
