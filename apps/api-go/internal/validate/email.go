package validate

import "strings"

// NormalizeEmail trim spasi dan lowercase. Email RFC 5321 diperlakukan case-insensitive
// pada local-part di hampir semua provider; AISI menyimpan dan mencocokkan bentuk ini.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
