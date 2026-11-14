package analytics

import (
	"net/http"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireAuth(c))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Get("/overview", overview(db))
	r.With(middleware.RequireRole("SUPERADMIN", "ADMIN", "PJ_SEKOLAH")).Get("/liqo", serveLiqo(db))
	r.Get("/school/{id}", school(db))
	r.Get("/group/{id}", group(db))
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
func monday() time.Time {
	n := time.Now().In(time.FixedZone("WIB", 7*3600))
	d := (int(n.Weekday()) + 6) % 7
	y, m, day := n.Date()
	return time.Date(y, m, day-d, 0, 0, 0, 0, n.Location())
}
func accessibleSchool(db *pgxpool.Pool, r *http.Request, school string) bool {
	c, _ := middleware.Claims(r)
	if has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") {
		return true
	}
	var ok bool
	_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "UserSchool" WHERE "userId"=$1 AND "schoolId"=$2)`, c.UserID, school).Scan(&ok)
	return ok
}
func scope(db *pgxpool.Pool, r *http.Request) ([]string, bool) {
	c, _ := middleware.Claims(r)
	if has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") {
		return nil, true
	}
	rows, e := db.Query(r.Context(), `SELECT "schoolId" FROM "UserSchool" WHERE "userId"=$1`, c.UserID)
	if e != nil {
		return []string{}, false
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var x string
		if rows.Scan(&x) == nil {
			out = append(out, x)
		}
	}
	return out, false
}
func overview(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ids, city := scope(db, r)
		if !city && len(ids) == 0 {
			httpx.Success(w, 200, map[string]any{"scope": "school", "totalSchools": 0, "totalGroups": 0, "totalPembina": 0, "totalAnggota": 0, "submissionRate": 0, "evaluationsThisWeek": 0, "submissionRateLastWeek": 0, "evaluationsLastWeek": 0, "attendanceTrend": []any{}, "genderBreakdown": emptyBreakdown(), "levelBreakdown": emptyLevel(), "levelGenderBreakdown": emptyLevelGender(), "topSchools": []any{}}, "")
			return
		}
		where, args := `g."isActive"`, []any{}
		if !city {
			where += ` AND g."schoolId"=ANY($1)`
			args = append(args, ids)
		}
		var groups, pembina, members, submitted, submittedPrev int
		this := monday()
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "Group" g WHERE `+where, args...).Scan(&groups)
		_ = db.QueryRow(r.Context(), `SELECT count(DISTINCT g."pembinaId") FROM "Group" g WHERE `+where, args...).Scan(&pembina)
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."isActive" AND `+where, args...).Scan(&members)
		a := append(append([]any{}, args...), this)
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE e."isSubmitted" AND e."weekDate"=$`+itoa(len(a))+` AND `+where, a...).Scan(&submitted)
		aPrev := append(append([]any{}, args...), this.AddDate(0, 0, -7))
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE e."isSubmitted" AND e."weekDate"=$`+itoa(len(aPrev))+` AND `+where, aPrev...).Scan(&submittedPrev)
		data := map[string]any{"scope": map[bool]string{true: "city", false: "school"}[city], "totalGroups": groups, "totalPembina": pembina, "totalAnggota": members, "evaluationsThisWeek": submitted, "submissionRate": rate(submitted, groups), "evaluationsLastWeek": submittedPrev, "submissionRateLastWeek": rate(submittedPrev, groups), "attendanceTrend": trend(db, r, ids, city), "genderBreakdown": gender(db, r, ids, city), "levelBreakdown": level(db, r, ids, city), "levelGenderBreakdown": levelGender(db, r, ids, city), "topSchools": []any{}}
		if city {
			var schools int
			_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "School" WHERE "isActive"`).Scan(&schools)
			data["totalSchools"] = schools
			data["topSchools"] = topSchools(db, r)
		} else {
			data["totalSchools"] = len(ids)
		}
		httpx.Success(w, 200, data, "")
	}
}
func itoa(n int) string {
	const d = "0123456789"
	if n == 0 {
		return "0"
	}
	b := []byte{}
	for n > 0 {
		b = append([]byte{d[n%10]}, b...)
		n /= 10
	}
	return string(b)
}
func rate(a, b int) int {
	if b == 0 {
		return 0
	}
	return a * 100 / b
}
func condition(ids []string, city bool) (string, []any) {
	if city {
		return `g."isActive"`, nil
	}
	return `g."isActive" AND g."schoolId"=ANY($1)`, []any{ids}
}
func gender(db *pgxpool.Pool, r *http.Request, ids []string, city bool) map[string]any {
	q, a := condition(ids, city)
	var gi, ga, ai, aa, pi, pa int
	_ = db.QueryRow(r.Context(), `SELECT count(*) FILTER(WHERE g."gender"='IKHWAN'),count(*) FILTER(WHERE g."gender"='AKHWAT'),count(DISTINCT g."pembinaId") FILTER(WHERE u."gender"='IKHWAN'),count(DISTINCT g."pembinaId") FILTER(WHERE u."gender"='AKHWAT') FROM "Group" g JOIN "User" u ON u."id"=g."pembinaId" WHERE `+q, a...).Scan(&gi, &ga, &pi, &pa)
	_ = db.QueryRow(r.Context(), `SELECT count(*) FILTER(WHERE u."gender"='IKHWAN'),count(*) FILTER(WHERE u."gender"='AKHWAT') FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" JOIN "User" u ON u."id"=gm."userId" WHERE gm."isActive" AND `+q, a...).Scan(&ai, &aa)
	return map[string]any{"groups": map[string]int{"ikhwan": gi, "akhwat": ga}, "pembina": map[string]int{"ikhwan": pi, "akhwat": pa}, "anggota": map[string]int{"ikhwan": ai, "akhwat": aa}}
}
func emptyBreakdown() map[string]any {
	return map[string]any{"groups": map[string]int{"ikhwan": 0, "akhwat": 0}, "pembina": map[string]int{"ikhwan": 0, "akhwat": 0}, "anggota": map[string]int{"ikhwan": 0, "akhwat": 0}}
}
func level(db *pgxpool.Pool, r *http.Request, ids []string, city bool) map[string]any {
	q, a := condition(ids, city)
	var g0, g1, g2, p0, p1, p2, m0, m1, m2 int
	_ = db.QueryRow(r.Context(), `SELECT count(*) FILTER(WHERE "level"='LEVEL_0'),count(*) FILTER(WHERE "level"='LEVEL_1'),count(*) FILTER(WHERE "level"='LEVEL_2'),count(DISTINCT "pembinaId") FILTER(WHERE "level"='LEVEL_0'),count(DISTINCT "pembinaId") FILTER(WHERE "level"='LEVEL_1'),count(DISTINCT "pembinaId") FILTER(WHERE "level"='LEVEL_2') FROM "Group" g WHERE `+q, a...).Scan(&g0, &g1, &g2, &p0, &p1, &p2)
	_ = db.QueryRow(r.Context(), `SELECT count(*) FILTER(WHERE g."level"='LEVEL_0'),count(*) FILTER(WHERE g."level"='LEVEL_1'),count(*) FILTER(WHERE g."level"='LEVEL_2') FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE gm."isActive" AND `+q, a...).Scan(&m0, &m1, &m2)
	return map[string]any{"groups": map[string]int{"level0": g0, "level1": g1, "level2": g2}, "pembina": map[string]int{"level0": p0, "level1": p1, "level2": p2}, "anggota": map[string]int{"level0": m0, "level1": m1, "level2": m2}}
}
func emptyLevel() map[string]any {
	return map[string]any{"groups": map[string]int{"level0": 0, "level1": 0, "level2": 0}, "pembina": map[string]int{"level0": 0, "level1": 0, "level2": 0}, "anggota": map[string]int{"level0": 0, "level1": 0, "level2": 0}}
}
func levelGender(db *pgxpool.Pool, r *http.Request, ids []string, city bool) map[string]any { // Same counts are intentionally grouped by group level and gender.
	q, a := condition(ids, city)
	result := map[string]any{}
	for _, kind := range []string{"groups", "pembina", "anggota"} {
		lv := map[string]any{}
		for _, level := range []string{"LEVEL_0", "LEVEL_1", "LEVEL_2"} {
			var i, k int
			sql := `SELECT count(*) FILTER(WHERE g."gender"='IKHWAN'),count(*) FILTER(WHERE g."gender"='AKHWAT') FROM "Group" g WHERE ` + q + ` AND g."level"=$` + itoa(len(a)+1)
			if kind == "pembina" {
				sql = `SELECT count(DISTINCT g."pembinaId") FILTER(WHERE g."gender"='IKHWAN'),count(DISTINCT g."pembinaId") FILTER(WHERE g."gender"='AKHWAT') FROM "Group" g WHERE ` + q + ` AND g."level"=$` + itoa(len(a)+1)
			}
			if kind == "anggota" {
				sql = `SELECT count(*) FILTER(WHERE u."gender"='IKHWAN'),count(*) FILTER(WHERE u."gender"='AKHWAT') FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" JOIN "User" u ON u."id"=gm."userId" WHERE gm."isActive" AND ` + q + ` AND g."level"=$` + itoa(len(a)+1)
			}
			_ = db.QueryRow(r.Context(), sql, append(a, level)...).Scan(&i, &k)
			lv[map[string]string{"LEVEL_0": "level0", "LEVEL_1": "level1", "LEVEL_2": "level2"}[level]] = map[string]int{"ikhwan": i, "akhwat": k}
		}
		result[kind] = lv
	}
	return result
}
func emptyLevelGender() map[string]any {
	cell := func() map[string]int { return map[string]int{"ikhwan": 0, "akhwat": 0} }
	levels := func() map[string]any {
		return map[string]any{"level0": cell(), "level1": cell(), "level2": cell()}
	}
	return map[string]any{"groups": levels(), "pembina": levels(), "anggota": levels()}
}
func trend(db *pgxpool.Pool, r *http.Request, ids []string, city bool) []map[string]any {
	q, a := condition(ids, city)
	this := monday()
	idx := itoa(len(a) + 1)
	a = append(a, this.Format("2006-01-02"))
	rows, e := db.Query(r.Context(), `SELECT (($`+idx+`::date - e."weekDate"::date) / 7)::int, ROUND(count(*) FILTER (WHERE ea."status"='HADIR')::numeric/NULLIF(count(ea."id"),0)*100,1) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" LEFT JOIN "EvaluationAttendance" ea ON ea."evaluationId"=e."id" WHERE e."isSubmitted" AND e."weekDate">=$`+idx+`::date::timestamp - interval '49 days' AND e."weekDate"<=$`+idx+`::date::timestamp AND `+q+` GROUP BY 1`, a...)
	if e != nil {
		return []map[string]any{}
	}
	defer rows.Close()
	byAgo := map[int]float64{}
	found := map[int]bool{}
	for rows.Next() {
		var ago int
		var value *float64
		if rows.Scan(&ago, &value) == nil && ago >= 0 && ago < 8 && value != nil {
			byAgo[ago] = *value
			found[ago] = true
		}
	}
	out := make([]map[string]any, 0, 8)
	for ago := 7; ago >= 0; ago-- {
		item := map[string]any{"week": this.AddDate(0, 0, -7*ago).Format("2006-01-02"), "rate": nil}
		if found[ago] {
			item["rate"] = byAgo[ago]
		}
		out = append(out, item)
	}
	return out
}
func topSchools(db *pgxpool.Pool, r *http.Request) []map[string]any {
	rows, e := db.Query(r.Context(), `SELECT s."id",s."name",count(g."id") FILTER(WHERE g."isActive") FROM "School" s LEFT JOIN "Group" g ON g."schoolId"=s."id" WHERE s."isActive" GROUP BY s."id" LIMIT 5`)
	if e != nil {
		return []map[string]any{}
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, n string
		var x int
		if rows.Scan(&id, &n, &x) == nil {
			out = append(out, map[string]any{"id": id, "name": n, "groupCount": x})
		}
	}
	return out
}
func school(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, _ := middleware.Claims(r)
		if !has(c.Roles, "SUPERADMIN") && !has(c.Roles, "ADMIN") && !has(c.Roles, "PJ_SEKOLAH") {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		id := chi.URLParam(r, "id")
		if !accessibleSchool(db, r, id) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		var g, pembina, m, submitted, submittedPrev int
		this := monday()
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "Group" WHERE "schoolId"=$1 AND "isActive"`, id).Scan(&g)
		_ = db.QueryRow(r.Context(), `SELECT count(DISTINCT "pembinaId") FROM "Group" WHERE "schoolId"=$1 AND "isActive"`, id).Scan(&pembina)
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE g."schoolId"=$1 AND g."isActive" AND gm."isActive"`, id).Scan(&m)
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE g."schoolId"=$1 AND e."weekDate"=$2 AND e."isSubmitted"`, id, this).Scan(&submitted)
		_ = db.QueryRow(r.Context(), `SELECT count(*) FROM "WeeklyEvaluation" e JOIN "Group" g ON g."id"=e."groupId" WHERE g."schoolId"=$1 AND e."weekDate"=$2 AND e."isSubmitted"`, id, this.AddDate(0, 0, -7)).Scan(&submittedPrev)
		httpx.Success(w, 200, map[string]any{"totalGroups": g, "totalPembina": pembina, "totalAnggota": m, "submissionRate": rate(submitted, g), "evaluationsThisWeek": submitted, "submissionRateLastWeek": rate(submittedPrev, g), "evaluationsLastWeek": submittedPrev}, "")
	}
}
func group(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var school, pembina string
		e := db.QueryRow(r.Context(), `SELECT "schoolId","pembinaId" FROM "Group" WHERE "id"=$1`, id).Scan(&school, &pembina)
		if e == pgx.ErrNoRows {
			httpx.Error(w, 404, "Kelompok tidak ditemukan")
			return
		}
		c, _ := middleware.Claims(r)
		allowed := has(c.Roles, "SUPERADMIN") || has(c.Roles, "ADMIN") ||
			(has(c.Roles, "PJ_SEKOLAH") && accessibleSchool(db, r, school)) ||
			(has(c.Roles, "PEMBINA") && c.UserID == pembina)
		if !allowed {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		rows, _ := db.Query(r.Context(), `SELECT u."id",u."name",u."totalPoints",count(ea."id") FILTER(WHERE ea."status"='HADIR'),count(ea."id") FROM "GroupMember" gm JOIN "User" u ON u."id"=gm."userId" LEFT JOIN "EvaluationAttendance" ea ON ea."userId"=u."id" LEFT JOIN "WeeklyEvaluation" e ON e."id"=ea."evaluationId" AND e."groupId"=$1 AND e."isSubmitted" WHERE gm."groupId"=$1 AND gm."isActive" GROUP BY u."id"`, id)
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var uid, n string
			var p, h, t int
			if rows.Scan(&uid, &n, &p, &h, &t) == nil {
				out = append(out, map[string]any{"id": uid, "name": n, "totalPoints": p, "attendanceRate": rate(h, t), "totalHadir": h, "totalAbsen": t - h})
			}
		}
		var sub bool
		_ = db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "WeeklyEvaluation" WHERE "groupId"=$1 AND "weekDate"=$2 AND "isSubmitted")`, id, monday()).Scan(&sub)
		httpx.Success(w, 200, map[string]any{"totalMembers": len(out), "submittedThisWeek": sub, "members": out}, "")
	}
}
