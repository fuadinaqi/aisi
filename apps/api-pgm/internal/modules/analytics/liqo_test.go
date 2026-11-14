package analytics

import (
	"testing"
	"time"
)

func TestLiqoStatus(t *testing.T) {
	if got := liqoStatus(false, true, true); got != "MISSING" {
		t.Fatalf("tanpa evaluasi = %s", got)
	}
	if got := liqoStatus(true, false, false); got != "DRAFT" {
		t.Fatalf("draft = %s", got)
	}
	if got := liqoStatus(true, true, true); got != "LATE" {
		t.Fatalf("terlambat = %s", got)
	}
	if got := liqoStatus(true, true, false); got != "ON_TIME" {
		t.Fatalf("tepat waktu = %s", got)
	}
}

func TestSubmittedLate(t *testing.T) {
	week := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	onTime := time.Date(2026, 11, 15, 16, 0, 0, 0, time.UTC)
	late := time.Date(2026, 11, 15, 18, 0, 0, 0, time.UTC)
	if submittedLate(week, &onTime, true) {
		t.Fatal("Minggu 23.00 WIB masih tepat waktu")
	}
	if !submittedLate(week, &late, true) {
		t.Fatal("Senin 01.00 WIB terhitung terlambat")
	}
	if submittedLate(week, &late, false) {
		t.Fatal("draft tidak dihitung terlambat")
	}
	if submittedLate(week, nil, true) {
		t.Fatal("tanpa waktu submit tidak terlambat")
	}
}

func TestMissedStreak(t *testing.T) {
	if n, capped := missedStreak(map[int]bool{}, 0); n != 0 || capped {
		t.Fatalf("kelompok baru = %d capped=%v", n, capped)
	}
	if n, capped := missedStreak(map[int]bool{2: true}, 4); n != 1 || capped {
		t.Fatalf("satu pekan kosong = %d capped=%v", n, capped)
	}
	if n, capped := missedStreak(map[int]bool{}, 3); n != 3 || capped {
		t.Fatalf("3 pekan kosong = %d capped=%v", n, capped)
	}
	if n, capped := missedStreak(map[int]bool{}, 12); n != 8 || !capped {
		t.Fatalf("lebih dari jendela = %d capped=%v", n, capped)
	}
}

func TestAbsentStreak(t *testing.T) {
	if got := absentStreak(nil); got != 0 {
		t.Fatalf("kosong = %d", got)
	}
	if got := absentStreak(map[int]string{0: "TIDAK_HADIR", 1: "TIDAK_HADIR", 2: "HADIR"}); got != 2 {
		t.Fatalf("dua alpa = %d", got)
	}
	if got := absentStreak(map[int]string{1: "TIDAK_HADIR", 2: "TIDAK_HADIR"}); got != 2 {
		t.Fatalf("alpa sejak laporan terakhir = %d", got)
	}
	if got := absentStreak(map[int]string{0: "HADIR", 1: "TIDAK_HADIR"}); got != 0 {
		t.Fatalf("hadir pekan terakhir = %d", got)
	}
	if got := absentStreak(map[int]string{0: "TIDAK_HADIR", 2: "TIDAK_HADIR"}); got != 1 {
		t.Fatalf("pekan tanpa laporan memutus rentetan = %d", got)
	}
}

func TestFillGroupAndSummary(t *testing.T) {
	notes := "  catatan pembina  "
	byAgo := map[int]*evalSnap{
		0: {id: "e0", submitted: true, late: false, hadir: 3, tidak: 1, notes: clipPtr(&notes, 140)},
		1: {id: "e1", submitted: true, late: true, hadir: 1, izin: 1},
	}
	row := fillGroup(rawGroup{
		id: "g1", name: "Kelompok A", level: "LEVEL_1", gender: "IKHWAN",
		schoolID: "s1", schoolName: "PGM A", pembinaID: "p1", pembinaName: "Pembina",
		memberCount: 4, createdWeeksAgo: 3,
	}, byAgo)
	if row.Status != "ON_TIME" || row.EvaluationID == nil || *row.EvaluationID != "e0" {
		t.Fatalf("status pekan ini = %s id=%v", row.Status, row.EvaluationID)
	}
	if row.Hadir != 3 || row.TidakHadir != 1 || row.AttendanceRate == nil || *row.AttendanceRate != 75 {
		t.Fatalf("absensi = %+v rate=%v", row, row.AttendanceRate)
	}
	if row.MissedStreak != 0 {
		t.Fatalf("streak = %d", row.MissedStreak)
	}
	if row.LateCount != 1 || row.LateWindowSubmitted != 1 {
		t.Fatalf("terlambat = %d/%d", row.LateCount, row.LateWindowSubmitted)
	}
	if row.Weeks[7] != "ON_TIME" || row.Weeks[6] != "LATE" || row.Weeks[5] != "MISSING" || row.Weeks[0] != "BEFORE" {
		t.Fatalf("jejak pekan = %v", row.Weeks)
	}
	if row.Notes == nil || *row.Notes != "catatan pembina" {
		t.Fatalf("catatan = %v", row.Notes)
	}

	silent := fillGroup(rawGroup{id: "g2", name: "B", createdWeeksAgo: 2}, nil)
	if silent.Status != "MISSING" || silent.MissedStreak != 2 || silent.EvaluationID != nil {
		t.Fatalf("kelompok diam = %+v", silent)
	}

	snaps := map[string]map[int]*evalSnap{"g1": byAgo, "g2": {}}
	this := summarizeWeek("2026-11-09", []liqoGroup{row, silent}, 7, snaps)
	if this.TotalGroups != 2 || this.Submitted != 1 || this.OnTime != 1 || this.Missing != 1 || this.SubmissionRate != 50 {
		t.Fatalf("ringkasan pekan ini = %+v", this)
	}
	if this.Hadir != 3 || this.TidakHadir != 1 || this.AttendanceRate == nil || *this.AttendanceRate != 75 {
		t.Fatalf("kehadiran pekan ini = %+v", this)
	}
	last := summarizeWeek("2026-11-02", []liqoGroup{row, silent}, 6, snaps)
	if last.Late != 1 || last.Missing != 1 || last.Hadir != 1 || last.Izin != 1 {
		t.Fatalf("ringkasan pekan lalu = %+v", last)
	}
}

func TestCollectAbsences(t *testing.T) {
	rows := []rawAbsence{
		{userID: "u1", name: "Budi", groupID: "g1", groupName: "A", schoolName: "PGM", ago: 0, status: "TIDAK_HADIR"},
		{userID: "u1", name: "Budi", groupID: "g1", groupName: "A", schoolName: "PGM", ago: 1, status: "TIDAK_HADIR"},
		{userID: "u2", name: "Ani", groupID: "g1", groupName: "A", schoolName: "PGM", ago: 0, status: "HADIR"},
		{userID: "u2", name: "Ani", groupID: "g1", groupName: "A", schoolName: "PGM", ago: 1, status: "TIDAK_HADIR"},
	}
	got, total := collectAbsences(rows)
	if total != 1 || len(got) != 1 || got[0].Name != "Budi" || got[0].Weeks != 2 {
		t.Fatalf("absen = %+v total=%d", got, total)
	}
}
