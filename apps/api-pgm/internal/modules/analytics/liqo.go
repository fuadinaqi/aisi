package analytics

import (
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/response"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	liqoHistoryWeeks     = 8
	liqoSilentWeeks      = 2
	liqoLowAttendance    = 60
	liqoMinReportedWeeks = 2
	liqoAbsentWeeks      = 2
	liqoLatePembinaMin   = 2
	liqoLateWindow       = 4
	liqoAbsentCap        = 50
	liqoNoteLimit        = 140
)

type liqoThresholds struct {
	SilentWeeks        int `json:"silentWeeks"`
	LowAttendance      int `json:"lowAttendance"`
	MinAttendanceWeeks int `json:"minAttendanceWeeks"`
	AbsentWeeks        int `json:"absentWeeks"`
	LatePembina        int `json:"latePembina"`
}

func defaultThresholds() liqoThresholds {
	return liqoThresholds{
		SilentWeeks:        liqoSilentWeeks,
		LowAttendance:      liqoLowAttendance,
		MinAttendanceWeeks: liqoMinReportedWeeks,
		AbsentWeeks:        liqoAbsentWeeks,
		LatePembina:        liqoLatePembinaMin,
	}
}

type liqoSchool struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type liqoWeek struct {
	WeekDate       string `json:"weekDate"`
	TotalGroups    int    `json:"totalGroups"`
	Submitted      int    `json:"submitted"`
	OnTime         int    `json:"onTime"`
	Late           int    `json:"late"`
	Draft          int    `json:"draft"`
	Missing        int    `json:"missing"`
	SubmissionRate int    `json:"submissionRate"`
	Hadir          int    `json:"hadir"`
	Izin           int    `json:"izin"`
	Sakit          int    `json:"sakit"`
	TidakHadir     int    `json:"tidakHadir"`
	AttendanceRate *int   `json:"attendanceRate"`
}

type liqoGroup struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Level                string   `json:"level"`
	Gender               string   `json:"gender"`
	SchoolID             string   `json:"schoolId"`
	SchoolName           string   `json:"schoolName"`
	PembinaID            string   `json:"pembinaId"`
	PembinaName          string   `json:"pembinaName"`
	PembinaPhone         *string  `json:"pembinaPhone,omitempty"`
	MemberCount          int      `json:"memberCount"`
	Status               string   `json:"status"`
	EvaluationID         *string  `json:"evaluationId,omitempty"`
	Hadir                int      `json:"hadir"`
	Izin                 int      `json:"izin"`
	Sakit                int      `json:"sakit"`
	TidakHadir           int      `json:"tidakHadir"`
	AttendanceRate       *int     `json:"attendanceRate"`
	Location             *string  `json:"location,omitempty"`
	SessionDate          *string  `json:"sessionDate,omitempty"`
	Notes                *string  `json:"notes,omitempty"`
	MissedStreak         int      `json:"missedStreak"`
	MissedStreakCapped   bool     `json:"missedStreakCapped"`
	RecentAttendanceRate *int     `json:"recentAttendanceRate"`
	RecentSubmittedWeeks int      `json:"recentSubmittedWeeks"`
	LateCount            int      `json:"lateCount"`
	LateWindowSubmitted  int      `json:"lateWindowSubmitted"`
	Weeks                []string `json:"weeks"`
}

type liqoAbsent struct {
	UserID     string `json:"userId"`
	Name       string `json:"name"`
	GroupID    string `json:"groupId"`
	GroupName  string `json:"groupName"`
	SchoolName string `json:"schoolName"`
	Weeks      int    `json:"weeks"`
}

type liqoBoard struct {
	WeekDate         string         `json:"weekDate"`
	PreviousWeekDate string         `json:"previousWeekDate"`
	ThisWeek         liqoWeek       `json:"thisWeek"`
	LastWeek         liqoWeek       `json:"lastWeek"`
	Schools          []liqoSchool   `json:"schools"`
	Groups           []liqoGroup    `json:"groups"`
	AbsentMembers    []liqoAbsent   `json:"absentMembers"`
	AbsentTotal      int            `json:"absentTotal"`
	Thresholds       liqoThresholds `json:"thresholds"`
}

type rawGroup struct {
	id, name, level, gender      string
	schoolID, schoolName         string
	pembinaID, pembinaName       string
	pembinaPhone                 *string
	memberCount, createdWeeksAgo int
}

type evalSnap struct {
	id                 string
	submitted, late    bool
	hadir, izin, sakit int
	tidak              int
	notes, location    *string
	session            *string
}

type markCount struct {
	hadir, izin, sakit, tidak int
}

func liqoStatus(hasEval, submitted, late bool) string {
	switch {
	case !hasEval:
		return "MISSING"
	case !submitted:
		return "DRAFT"
	case late:
		return "LATE"
	default:
		return "ON_TIME"
	}
}

func (s *evalSnap) status() string {
	if s == nil {
		return "MISSING"
	}
	return liqoStatus(true, s.submitted, s.late)
}

func weekCell(createdWeeksAgo, ago int, snap *evalSnap) string {
	if ago > createdWeeksAgo {
		return "BEFORE"
	}
	if snap == nil {
		return "MISSING"
	}
	return snap.status()
}

func missedStreak(submitted map[int]bool, createdWeeksAgo int) (int, bool) {
	if createdWeeksAgo < 1 {
		return 0, false
	}
	limit := createdWeeksAgo
	if limit > liqoHistoryWeeks {
		limit = liqoHistoryWeeks
	}
	n := 0
	for ago := 1; ago <= limit; ago++ {
		if submitted[ago] {
			break
		}
		n++
	}
	return n, n == liqoHistoryWeeks && createdWeeksAgo > liqoHistoryWeeks
}

func absentStreak(statusByAgo map[int]string) int {
	if len(statusByAgo) == 0 {
		return 0
	}
	start := -1
	for ago := range statusByAgo {
		if start < 0 || ago < start {
			start = ago
		}
	}
	n := 0
	for ago := start; ago < start+liqoHistoryWeeks; ago++ {
		st, ok := statusByAgo[ago]
		if !ok || st != "TIDAK_HADIR" {
			break
		}
		n++
	}
	return n
}

func statusRank(status string) int {
	switch status {
	case "MISSING":
		return 0
	case "DRAFT":
		return 1
	case "LATE":
		return 2
	default:
		return 3
	}
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func clipPtr(s *string, n int) *string {
	t := trimPtr(s)
	if t == nil {
		return nil
	}
	r := []rune(*t)
	if len(r) <= n {
		return t
	}
	if n < 1 {
		return nil
	}
	out := string(r[:n-1]) + "…"
	return &out
}

func wibLoc() *time.Location { return time.FixedZone("WIB", 7*3600) }

// submittedLate memakai jam dinding yang tersimpan: weekDate ditulis sebagai tengah malam WIB,
// submittedAt ditulis sebagai jam UTC. Batas tepat waktu adalah Senin berikutnya pukul 00.00 WIB.
func submittedLate(weekWall time.Time, submittedAt *time.Time, submitted bool) bool {
	if !submitted || submittedAt == nil || submittedAt.IsZero() {
		return false
	}
	y, m, d := weekWall.In(time.UTC).Date()
	deadline := time.Date(y, m, d, 0, 0, 0, 0, wibLoc()).AddDate(0, 0, 7)
	sy, sm, sd := submittedAt.In(time.UTC).Date()
	hh, mm, ss := submittedAt.In(time.UTC).Clock()
	at := time.Date(sy, sm, sd, hh, mm, ss, submittedAt.In(time.UTC).Nanosecond(), time.UTC)
	return at.After(deadline.Add(-time.Millisecond))
}

func rateOrNil(part, total int) *int {
	if total <= 0 {
		return nil
	}
	v := rate(part, total)
	return &v
}

func fillGroup(g rawGroup, byAgo map[int]*evalSnap) liqoGroup {
	weeks := make([]string, liqoHistoryWeeks)
	submittedAgo := map[int]bool{}
	hadir, marked, reported := 0, 0, 0
	lateCount, lateWindow := 0, 0
	for ago := 0; ago < liqoHistoryWeeks; ago++ {
		snap := byAgo[ago]
		weeks[liqoHistoryWeeks-1-ago] = weekCell(g.createdWeeksAgo, ago, snap)
		if snap == nil || !snap.submitted {
			continue
		}
		submittedAgo[ago] = true
		reported++
		hadir += snap.hadir
		marked += snap.hadir + snap.izin + snap.sakit + snap.tidak
		if ago >= 1 && ago <= liqoLateWindow {
			lateWindow++
			if snap.late {
				lateCount++
			}
		}
	}
	streak, capped := missedStreak(submittedAgo, g.createdWeeksAgo)
	current := byAgo[0]
	row := liqoGroup{
		ID: g.id, Name: g.name, Level: g.level, Gender: g.gender,
		SchoolID: g.schoolID, SchoolName: g.schoolName,
		PembinaID: g.pembinaID, PembinaName: g.pembinaName, PembinaPhone: g.pembinaPhone,
		MemberCount: g.memberCount, Status: weekCell(g.createdWeeksAgo, 0, current),
		MissedStreak: streak, MissedStreakCapped: capped,
		RecentAttendanceRate: rateOrNil(hadir, marked), RecentSubmittedWeeks: reported,
		LateCount: lateCount, LateWindowSubmitted: lateWindow, Weeks: weeks,
	}
	if current != nil {
		id := current.id
		row.EvaluationID = &id
		row.Hadir = current.hadir
		row.Izin = current.izin
		row.Sakit = current.sakit
		row.TidakHadir = current.tidak
		row.AttendanceRate = rateOrNil(current.hadir, current.hadir+current.izin+current.sakit+current.tidak)
		row.Location = current.location
		row.SessionDate = current.session
		row.Notes = current.notes
	}
	return row
}

func summarizeWeek(weekDate string, groups []liqoGroup, idx int, snaps map[string]map[int]*evalSnap) liqoWeek {
	w := liqoWeek{WeekDate: weekDate}
	hadir, izin, sakit, alpa := 0, 0, 0, 0
	ago := liqoHistoryWeeks - 1 - idx
	for _, g := range groups {
		if idx < 0 || idx >= len(g.Weeks) {
			continue
		}
		switch g.Weeks[idx] {
		case "BEFORE":
			continue
		case "ON_TIME":
			w.OnTime++
			w.Submitted++
		case "LATE":
			w.Late++
			w.Submitted++
		case "DRAFT":
			w.Draft++
		default:
			w.Missing++
		}
		w.TotalGroups++
		if g.Weeks[idx] != "ON_TIME" && g.Weeks[idx] != "LATE" {
			continue
		}
		snap := snaps[g.ID][ago]
		if snap == nil {
			continue
		}
		hadir += snap.hadir
		izin += snap.izin
		sakit += snap.sakit
		alpa += snap.tidak
	}
	w.Hadir, w.Izin, w.Sakit, w.TidakHadir = hadir, izin, sakit, alpa
	w.SubmissionRate = rate(w.Submitted, w.TotalGroups)
	w.AttendanceRate = rateOrNil(hadir, hadir+izin+sakit+alpa)
	return w
}

func emptyLiqo(this time.Time, schools []liqoSchool) liqoBoard {
	if schools == nil {
		schools = []liqoSchool{}
	}
	prev := this.AddDate(0, 0, -7)
	return liqoBoard{
		WeekDate: this.Format("2006-01-02"), PreviousWeekDate: prev.Format("2006-01-02"),
		ThisWeek: liqoWeek{WeekDate: this.Format("2006-01-02")}, LastWeek: liqoWeek{WeekDate: prev.Format("2006-01-02")},
		Schools: schools, Groups: []liqoGroup{}, AbsentMembers: []liqoAbsent{}, Thresholds: defaultThresholds(),
	}
}

func liqoScope(this time.Time, city bool, ids []string, schoolID string) (string, []any) {
	where := `g."isActive"`
	args := []any{this.Format("2006-01-02")}
	if !city {
		args = append(args, ids)
		where += ` AND g."schoolId"=ANY($2)`
	}
	if schoolID != "" {
		args = append(args, schoolID)
		where += ` AND g."schoolId"=$` + itoa(len(args))
	}
	return where, args
}

func serveLiqo(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ids, city := scope(db, r)
		this := monday()
		if !city && len(ids) == 0 {
			httpx.Success(w, 200, emptyLiqo(this, nil), "")
			return
		}
		schoolID := strings.TrimSpace(r.URL.Query().Get("schoolId"))
		if schoolID != "" && !accessibleSchool(db, r, schoolID) {
			httpx.Error(w, 403, "Akses ditolak")
			return
		}
		schools, err := loadLiqoSchools(db, r, city, ids)
		if err != nil {
			log.Printf("liqo schools: %v", err)
			httpx.Error(w, 500, "Gagal memuat liqo pekanan")
			return
		}
		where, args := liqoScope(this, city, ids, schoolID)
		rawGroups, err := loadLiqoGroups(db, r, where, args)
		if err != nil {
			log.Printf("liqo groups: %v", err)
			httpx.Error(w, 500, "Gagal memuat liqo pekanan")
			return
		}
		evals, err := loadLiqoEvals(db, r, where, args)
		if err != nil {
			log.Printf("liqo evals: %v", err)
			httpx.Error(w, 500, "Gagal memuat liqo pekanan")
			return
		}
		marks, err := loadLiqoMarks(db, r, where, args)
		if err != nil {
			log.Printf("liqo marks: %v", err)
			httpx.Error(w, 500, "Gagal memuat liqo pekanan")
			return
		}
		absences, err := loadLiqoAbsences(db, r, where, args)
		if err != nil {
			log.Printf("liqo absences: %v", err)
			httpx.Error(w, 500, "Gagal memuat liqo pekanan")
			return
		}
		httpx.Success(w, 200, assembleLiqo(this, schools, rawGroups, evals, marks, absences), "")
	}
}

func loadLiqoSchools(db *pgxpool.Pool, r *http.Request, city bool, ids []string) ([]liqoSchool, error) {
	q := `SELECT "id","name" FROM "School" WHERE "isActive"`
	args := []any{}
	if !city {
		q += ` AND "id"=ANY($1)`
		args = append(args, ids)
	}
	q += ` ORDER BY "name"`
	rows, err := db.Query(r.Context(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []liqoSchool{}
	for rows.Next() {
		var s liqoSchool
		if err = rows.Scan(&s.ID, &s.Name); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func loadLiqoGroups(db *pgxpool.Pool, r *http.Request, where string, args []any) ([]rawGroup, error) {
	rows, err := db.Query(r.Context(), `
		SELECT g."id", g."name", g."level"::text, g."gender"::text, s."id", s."name", u."id", u."name", u."phone",
			(SELECT count(*) FROM "GroupMember" gm WHERE gm."groupId"=g."id" AND gm."isActive")::int,
			GREATEST((($1::date - g."createdAt"::date) / 7), 0)::int
		FROM "Group" g
		JOIN "School" s ON s."id"=g."schoolId"
		JOIN "User" u ON u."id"=g."pembinaId"
		WHERE `+where+` ORDER BY s."name", g."name"`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []rawGroup{}
	for rows.Next() {
		var g rawGroup
		var phone *string
		if err = rows.Scan(&g.id, &g.name, &g.level, &g.gender, &g.schoolID, &g.schoolName, &g.pembinaID, &g.pembinaName, &phone, &g.memberCount, &g.createdWeeksAgo); err != nil {
			return nil, err
		}
		g.pembinaPhone = trimPtr(phone)
		out = append(out, g)
	}
	return out, rows.Err()
}

func loadLiqoEvals(db *pgxpool.Pool, r *http.Request, where string, args []any) (map[string]map[int]*evalSnap, error) {
	rows, err := db.Query(r.Context(), `
		SELECT e."id", e."groupId", (($1::date - e."weekDate"::date) / 7)::int, e."isSubmitted",
			e."weekDate", e."submittedAt", e."notes", e."location", to_char(e."sessionDate", 'YYYY-MM-DD')
		FROM "WeeklyEvaluation" e
		JOIN "Group" g ON g."id"=e."groupId"
		WHERE `+where+` AND e."weekDate" >= $1::date::timestamp - interval '49 days' AND e."weekDate" <= $1::date::timestamp`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]map[int]*evalSnap{}
	for rows.Next() {
		var snap evalSnap
		var groupID string
		var ago int
		var weekDate time.Time
		var submittedAt *time.Time
		var notes, location, session *string
		if err = rows.Scan(&snap.id, &groupID, &ago, &snap.submitted, &weekDate, &submittedAt, &notes, &location, &session); err != nil {
			return nil, err
		}
		if ago < 0 || ago >= liqoHistoryWeeks {
			continue
		}
		snap.late = submittedLate(weekDate, submittedAt, snap.submitted)
		snap.notes = clipPtr(notes, liqoNoteLimit)
		snap.location = trimPtr(location)
		snap.session = trimPtr(session)
		if out[groupID] == nil {
			out[groupID] = map[int]*evalSnap{}
		}
		copied := snap
		out[groupID][ago] = &copied
	}
	return out, rows.Err()
}

func loadLiqoMarks(db *pgxpool.Pool, r *http.Request, where string, args []any) (map[string]markCount, error) {
	rows, err := db.Query(r.Context(), `
		SELECT a."evaluationId",
			count(*) FILTER (WHERE a."status"='HADIR'),
			count(*) FILTER (WHERE a."status"='IZIN'),
			count(*) FILTER (WHERE a."status"='SAKIT'),
			count(*) FILTER (WHERE a."status"='TIDAK_HADIR')
		FROM "EvaluationAttendance" a
		JOIN "WeeklyEvaluation" e ON e."id"=a."evaluationId"
		JOIN "Group" g ON g."id"=e."groupId"
		WHERE `+where+` AND e."weekDate" >= $1::date::timestamp - interval '49 days' AND e."weekDate" <= $1::date::timestamp
		GROUP BY a."evaluationId"`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]markCount{}
	for rows.Next() {
		var id string
		var m markCount
		if err = rows.Scan(&id, &m.hadir, &m.izin, &m.sakit, &m.tidak); err != nil {
			return nil, err
		}
		out[id] = m
	}
	return out, rows.Err()
}

type rawAbsence struct {
	userID, name, groupID, groupName, schoolName, status string
	ago                                                  int
}

func loadLiqoAbsences(db *pgxpool.Pool, r *http.Request, where string, args []any) ([]rawAbsence, error) {
	rows, err := db.Query(r.Context(), `
		SELECT gm."userId", u."name", g."id", g."name", s."name",
			(($1::date - e."weekDate"::date) / 7)::int, COALESCE(a."status"::text, '')
		FROM "GroupMember" gm
		JOIN "User" u ON u."id"=gm."userId"
		JOIN "Group" g ON g."id"=gm."groupId"
		JOIN "School" s ON s."id"=g."schoolId"
		JOIN "WeeklyEvaluation" e ON e."groupId"=g."id" AND e."isSubmitted"
			AND e."weekDate" >= $1::date::timestamp - interval '49 days' AND e."weekDate" <= $1::date::timestamp
		LEFT JOIN "EvaluationAttendance" a ON a."evaluationId"=e."id" AND a."userId"=gm."userId"
		WHERE gm."isActive" AND `+where+` AND gm."joinedAt" < e."weekDate" + interval '7 days'`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []rawAbsence{}
	for rows.Next() {
		var row rawAbsence
		if err = rows.Scan(&row.userID, &row.name, &row.groupID, &row.groupName, &row.schoolName, &row.ago, &row.status); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func assembleLiqo(this time.Time, schools []liqoSchool, rawGroups []rawGroup, evals map[string]map[int]*evalSnap, marks map[string]markCount, absences []rawAbsence) liqoBoard {
	if schools == nil {
		schools = []liqoSchool{}
	}
	for _, byAgo := range evals {
		for _, snap := range byAgo {
			if m, ok := marks[snap.id]; ok {
				snap.hadir, snap.izin, snap.sakit, snap.tidak = m.hadir, m.izin, m.sakit, m.tidak
			}
		}
	}
	groups := make([]liqoGroup, 0, len(rawGroups))
	for _, g := range rawGroups {
		groups = append(groups, fillGroup(g, evals[g.id]))
	}
	sort.Slice(groups, func(i, j int) bool {
		if ri, rj := statusRank(groups[i].Status), statusRank(groups[j].Status); ri != rj {
			return ri < rj
		}
		if groups[i].SchoolName != groups[j].SchoolName {
			return groups[i].SchoolName < groups[j].SchoolName
		}
		return groups[i].Name < groups[j].Name
	})
	prev := this.AddDate(0, 0, -7)
	board := liqoBoard{
		WeekDate: this.Format("2006-01-02"), PreviousWeekDate: prev.Format("2006-01-02"),
		ThisWeek: summarizeWeek(this.Format("2006-01-02"), groups, liqoHistoryWeeks-1, evals),
		LastWeek: summarizeWeek(prev.Format("2006-01-02"), groups, liqoHistoryWeeks-2, evals),
		Schools:  schools, Groups: groups, Thresholds: defaultThresholds(),
	}
	board.AbsentMembers, board.AbsentTotal = collectAbsences(absences)
	return board
}

func collectAbsences(rows []rawAbsence) ([]liqoAbsent, int) {
	type acc struct {
		name, groupName, schoolName string
		byAgo                       map[int]string
	}
	byKey := map[string]*acc{}
	order := []string{}
	for _, row := range rows {
		if row.ago < 0 || row.ago >= liqoHistoryWeeks {
			continue
		}
		key := row.userID + "\x00" + row.groupID
		item := byKey[key]
		if item == nil {
			item = &acc{name: row.name, groupName: row.groupName, schoolName: row.schoolName, byAgo: map[int]string{}}
			byKey[key] = item
			order = append(order, key)
		}
		item.byAgo[row.ago] = row.status
	}
	out := []liqoAbsent{}
	for _, key := range order {
		item := byKey[key]
		weeks := absentStreak(item.byAgo)
		if weeks < liqoAbsentWeeks {
			continue
		}
		userID, groupID, _ := strings.Cut(key, "\x00")
		out = append(out, liqoAbsent{
			UserID: userID, Name: item.name, GroupID: groupID, GroupName: item.groupName, SchoolName: item.schoolName, Weeks: weeks,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Weeks != out[j].Weeks {
			return out[i].Weeks > out[j].Weeks
		}
		return out[i].Name < out[j].Name
	})
	total := len(out)
	if len(out) > liqoAbsentCap {
		out = out[:liqoAbsentCap]
	}
	return out, total
}
