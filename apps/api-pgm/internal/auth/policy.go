package auth

import (
	"fmt"
	"unicode"
)

// ValidatePassword matches shared Zod passwordSchema: min 8, ≥1 uppercase, ≥1 digit.
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("Password minimal 8 karakter")
	}
	hasUpper, hasDigit := false, false
	for _, r := range password {
		if unicode.IsUpper(r) {
			hasUpper = true
		}
		if unicode.IsDigit(r) {
			hasDigit = true
		}
	}
	if !hasUpper {
		return fmt.Errorf("Password harus mengandung minimal 1 huruf besar")
	}
	if !hasDigit {
		return fmt.Errorf("Password harus mengandung minimal 1 angka")
	}
	return nil
}
