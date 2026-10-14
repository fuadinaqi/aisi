package storage

import (
	"fmt"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"
)

const maxDisplayFilenameRunes = 200

// DisplayFilename returns a safe original filename for UI and Content-Disposition.
func DisplayFilename(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "\\", "/")
	name = path.Base(name)
	name = strings.ReplaceAll(name, "\x00", "")
	name = strings.Trim(name, " .")
	if name == "" || name == "." || name == ".." {
		return "file"
	}
	if utf8.RuneCountInString(name) <= maxDisplayFilenameRunes {
		return name
	}
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	limit := maxDisplayFilenameRunes - utf8.RuneCountInString(ext)
	if limit < 1 {
		runes := []rune(name)
		return string(runes[:maxDisplayFilenameRunes])
	}
	return string([]rune(base)[:limit]) + ext
}

// ReplaceExt replaces the filename extension, keeping the base name.
func ReplaceExt(name, ext string) string {
	name = DisplayFilename(name)
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	prev := filepath.Ext(name)
	if prev == "" {
		return name + ext
	}
	return strings.TrimSuffix(name, prev) + ext
}

// ContentDisposition builds a Content-Disposition header with ASCII fallback and RFC 5987 filename*.
func ContentDisposition(kind, filename string) string {
	if kind == "" {
		kind = "attachment"
	}
	name := DisplayFilename(filename)
	fallback := asciiFilename(name)
	quoted := strings.ReplaceAll(fallback, `\`, `\\`)
	quoted = strings.ReplaceAll(quoted, `"`, `\"`)
	if fallback == name {
		return fmt.Sprintf(`%s; filename="%s"`, kind, quoted)
	}
	return fmt.Sprintf(`%s; filename="%s"; filename*=UTF-8''%s`, kind, quoted, url.PathEscape(name))
}

func asciiFilename(name string) string {
	ext := filepath.Ext(name)
	var b strings.Builder
	for _, r := range strings.TrimSuffix(name, ext) {
		switch {
		case r > unicode.MaxASCII:
			b.WriteByte('_')
		case unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' || r == '.':
			b.WriteRune(r)
		case unicode.IsSpace(r):
			b.WriteByte('_')
		default:
			b.WriteByte('_')
		}
	}
	base := strings.Trim(b.String(), "._")
	if base == "" {
		base = "file"
	}
	if ext == "" {
		return base
	}
	cleanExt := strings.Builder{}
	for _, r := range ext {
		if r == '.' || unicode.IsLetter(r) || unicode.IsDigit(r) {
			cleanExt.WriteRune(r)
		}
	}
	out := cleanExt.String()
	if out == "" || out == "." {
		return base
	}
	return base + strings.ToLower(out)
}
