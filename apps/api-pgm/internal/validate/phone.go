package validate

import (
	"regexp"
	"strings"
)

var nonDigit = regexp.MustCompile(`\D+`)

// NormalizeWhatsApp returns digits in 62… form, or empty if invalid.
// Accepts 08…, 8…, +62…, 62….
func NormalizeWhatsApp(phone string) string {
	digits := nonDigit.ReplaceAllString(strings.TrimSpace(phone), "")
	if digits == "" {
		return ""
	}
	switch {
	case strings.HasPrefix(digits, "0"):
		digits = "62" + digits[1:]
	case strings.HasPrefix(digits, "8"):
		digits = "62" + digits
	case strings.HasPrefix(digits, "62"):
		// ok
	default:
		return ""
	}
	// Indonesian mobile: 628xxxxxxxxx — total 11–15 digits, after 62 must start with 8
	if len(digits) < 11 || len(digits) > 15 {
		return ""
	}
	if !strings.HasPrefix(digits, "628") {
		return ""
	}
	return digits
}

func ValidWhatsApp(phone string) bool {
	return NormalizeWhatsApp(phone) != ""
}
