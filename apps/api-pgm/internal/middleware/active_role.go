package middleware

import (
	"errors"
	"strings"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/auth"
)

// ActiveRoleHeader memilih satu peran dari token untuk seluruh permintaan.
// Kosong berarti semua peran di token tetap berlaku.
const ActiveRoleHeader = "X-Active-Role"

func applyActiveRole(claims *auth.Claims, header string) error {
	if claims == nil {
		return nil
	}
	header = strings.TrimSpace(header)
	if header == "" {
		return nil
	}
	for _, role := range claims.Roles {
		if role == header {
			claims.Roles = []string{header}
			return nil
		}
	}
	return errActiveRole
}

var errActiveRole = errors.New("peran aktif tidak valid")
