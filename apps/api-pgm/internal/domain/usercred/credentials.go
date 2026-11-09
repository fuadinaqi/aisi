package usercred

import (
	"context"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/validate"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserHasCredentials reports an active user with a full login identity (email + password).
func UserHasCredentials(ctx context.Context, db *pgxpool.Pool, email string) bool {
	email = validate.NormalizeEmail(email)
	if email == "" {
		return false
	}
	var ok bool
	_ = db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "User"
			WHERE LOWER("email")=$1 AND "isActive"
			  AND "email" IS NOT NULL AND "password" IS NOT NULL
		)`, email).Scan(&ok)
	return ok
}

// EmailTaken is true if email is used by a credentialed user or a pending invitation.
func EmailTaken(ctx context.Context, db *pgxpool.Pool, email string) bool {
	email = validate.NormalizeEmail(email)
	if email == "" {
		return false
	}
	var ok bool
	_ = db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "User"
			WHERE LOWER("email")=$1 AND "isActive"
			  AND "email" IS NOT NULL AND "password" IS NOT NULL
		) OR EXISTS(
			SELECT 1 FROM "UserInvitation"
			WHERE LOWER("email")=$1 AND "status"='PENDING' AND "expiresAt">NOW()
		)`, email).Scan(&ok)
	return ok
}

// EmailTakenExceptUser is like EmailTaken but ignores a user id (for activation).
func EmailTakenExceptUser(ctx context.Context, db *pgxpool.Pool, email, exceptUserID string) bool {
	email = validate.NormalizeEmail(email)
	if email == "" {
		return false
	}
	var ok bool
	_ = db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM "User"
			WHERE LOWER("email")=$1 AND "isActive" AND "id"<>$2
			  AND "email" IS NOT NULL AND "password" IS NOT NULL
		) OR EXISTS(
			SELECT 1 FROM "UserInvitation"
			WHERE LOWER("email")=$1 AND "status"='PENDING' AND "expiresAt">NOW()
		)`, email, exceptUserID).Scan(&ok)
	return ok
}

// HasAccountByID returns whether the user row has login credentials.
func HasAccountByID(ctx context.Context, db *pgxpool.Pool, userID string) (bool, error) {
	var ok bool
	err := db.QueryRow(ctx, `
		SELECT ("email" IS NOT NULL AND "password" IS NOT NULL)
		FROM "User" WHERE "id"=$1`, userID).Scan(&ok)
	return ok, err
}

// PendingActivationInviteID returns a pending activation invitation for targetUserId, if any.
func PendingActivationInviteID(ctx context.Context, db *pgxpool.Pool, targetUserID string) (string, bool) {
	var id string
	err := db.QueryRow(ctx, `
		SELECT "id" FROM "UserInvitation"
		WHERE "targetUserId"=$1 AND "status"='PENDING' AND "expiresAt">NOW()
		LIMIT 1`, targetUserID).Scan(&id)
	if err != nil {
		return "", false
	}
	return id, true
}

// ScanHasAccount is a convenience for nullable credential columns.
func ScanHasAccount(email, password *string) bool {
	return email != nil && *email != "" && password != nil && *password != ""
}

var _ = pgx.ErrNoRows
