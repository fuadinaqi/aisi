package notify

import (
	"context"
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Create inserts one notification. Errors are ignored by callers that use CreateMany best-effort.
func Create(ctx context.Context, db *pgxpool.Pool, userID, typ, title, body string, refID *string) error {
	_, err := db.Exec(ctx, `
		INSERT INTO "Notification" ("id","userId","type","title","body","refId")
		VALUES ($1,$2,$3::"NotifType",$4,$5,$6)`,
		uuid.NewString(), userID, typ, title, body, refID)
	return err
}

// CreateMany notifies each userID (deduped). Best-effort: continues on individual failures.
func CreateMany(ctx context.Context, db *pgxpool.Pool, userIDs []string, typ, title, body string, refID *string) {
	seen := map[string]struct{}{}
	for _, uid := range userIDs {
		if uid == "" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		_ = Create(ctx, db, uid, typ, title, body, refID)
	}
}

// UserIDsByRoles returns active user IDs that have any of the given roles.
func UserIDsByRoles(ctx context.Context, db *pgxpool.Pool, roles ...string) ([]string, error) {
	if len(roles) == 0 {
		return nil, nil
	}
	rows, err := db.Query(ctx, `
		SELECT DISTINCT ur."userId"
		FROM "UserRole" ur
		INNER JOIN "User" u ON u."id"=ur."userId"
		WHERE u."isActive"=true AND ur."role"::text = ANY($1)`, roles)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

// PJUserIDsForSchool returns active PJ_SEKOLAH user IDs for a school.
func PJUserIDsForSchool(ctx context.Context, db *pgxpool.Pool, schoolID string) ([]string, error) {
	rows, err := db.Query(ctx, `
		SELECT DISTINCT u."id"
		FROM "User" u
		INNER JOIN "UserSchool" us ON us."userId"=u."id"
		INNER JOIN "UserRole" ur ON ur."userId"=u."id"
		WHERE us."schoolId"=$1 AND u."isActive"=true AND ur."role"='PJ_SEKOLAH'::"Role"`, schoolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

// AudienceForEvent: PJ sekolah + pembina/anggota kelompok yang cocok (sekolah & gender).
// schoolID nil = semua sekolah; targetGender nil = ikhwan & akhwat.
func AudienceForEvent(ctx context.Context, db *pgxpool.Pool, schoolID *string, targetGender *string) ([]string, error) {
	if schoolID != nil && *schoolID == "" {
		schoolID = nil
	}
	q := `
		SELECT DISTINCT u."id" FROM "User" u
		WHERE u."isActive"=true AND (
			EXISTS (
				SELECT 1 FROM "UserRole" ur
				WHERE ur."userId"=u."id" AND ur."role"='PJ_SEKOLAH'::"Role"
				  AND (
					$1::text IS NULL
					OR EXISTS (SELECT 1 FROM "UserSchool" us WHERE us."userId"=u."id" AND us."schoolId"=$1)
				  )
			)
			OR EXISTS (
				SELECT 1 FROM "Group" g
				WHERE g."pembinaId"=u."id" AND g."isActive"=true
				  AND ($1::text IS NULL OR g."schoolId"=$1)
				  AND ($2::"Gender" IS NULL OR g."gender"=$2)
			)
			OR EXISTS (
				SELECT 1 FROM "GroupMember" gm
				INNER JOIN "Group" g ON g."id"=gm."groupId"
				WHERE gm."userId"=u."id" AND gm."isActive"=true AND g."isActive"=true
				  AND ($1::text IS NULL OR g."schoolId"=$1)
				  AND ($2::"Gender" IS NULL OR g."gender"=$2)
			)
		)`
	rows, err := db.Query(ctx, q, schoolID, targetGender)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

// AudienceForMateri: pembina + anggota di kelompok yang levelnya cocok (kosong = semua level).
func AudienceForMateri(ctx context.Context, db *pgxpool.Pool, levels []string) ([]string, error) {
	q := `
		SELECT DISTINCT u."id" FROM "User" u
		WHERE u."isActive"=true AND (
			EXISTS (
				SELECT 1 FROM "Group" g
				WHERE g."pembinaId"=u."id" AND g."isActive"=true
				  AND (cardinality($1::"GroupLevel"[])=0 OR g."level" = ANY($1::"GroupLevel"[]))
			)
			OR EXISTS (
				SELECT 1 FROM "GroupMember" gm
				INNER JOIN "Group" g ON g."id"=gm."groupId"
				WHERE gm."userId"=u."id" AND gm."isActive"=true AND g."isActive"=true
				  AND (cardinality($1::"GroupLevel"[])=0 OR g."level" = ANY($1::"GroupLevel"[]))
			)
		)`
	rows, err := db.Query(ctx, q, levels)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out, rows.Err()
}

func PointEarned(ctx context.Context, db *pgxpool.Pool, userID string, points int, description string, refID *string) {
	if userID == "" || points <= 0 {
		return
	}
	title := "+" + strconv.Itoa(points) + " poin"
	CreateMany(ctx, db, []string{userID}, "POINT_EARNED", title, description, refID)
}

func EventPublished(ctx context.Context, db *pgxpool.Pool, eventID, title string, schoolID *string, targetGender *string) {
	if schoolID != nil && *schoolID == "" {
		schoolID = nil
	}
	ids, err := AudienceForEvent(ctx, db, schoolID, targetGender)
	if err != nil || len(ids) == 0 {
		return
	}
	ref := eventID
	CreateMany(ctx, db, ids, "NEW_EVENT", "Agenda baru", title, &ref)
}

func MateriPublished(ctx context.Context, db *pgxpool.Pool, materiID, title string, levels []string) {
	ids, err := AudienceForMateri(ctx, db, levels)
	if err != nil || len(ids) == 0 {
		return
	}
	ref := materiID
	body := title
	if len(levels) > 0 {
		body = fmt.Sprintf("%s (%v)", title, levels)
	}
	CreateMany(ctx, db, ids, "NEW_MATERI", "Materi baru", body, &ref)
}
