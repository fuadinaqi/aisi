package storage

import (
	"bytes"
	"errors"
	"io"
	"path/filepath"
	"strings"
)

const (
	MaxImageBytes  = 5 << 20  // max raw upload before optimize
	MaxMateriBytes = 10 << 20
)

var errInvalidImage = errors.New("File harus berupa gambar (JPEG/PNG/WebP/GIF) maksimal 5MB")
var errInvalidMateri = errors.New("Tipe file tidak diizinkan atau ukuran melebihi 10MB")

// DetectContentType inspects magic bytes. Returns empty string if unknown/unsafe.
func DetectContentType(header []byte) string {
	if len(header) < 12 {
		return ""
	}
	switch {
	case bytes.HasPrefix(header, []byte{0xFF, 0xD8, 0xFF}):
		return "image/jpeg"
	case bytes.HasPrefix(header, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}):
		return "image/png"
	case bytes.HasPrefix(header, []byte("GIF87a")) || bytes.HasPrefix(header, []byte("GIF89a")):
		return "image/gif"
	case len(header) >= 12 && bytes.Equal(header[0:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WEBP")):
		return "image/webp"
	case bytes.HasPrefix(header, []byte("%PDF-")):
		return "application/pdf"
	case bytes.HasPrefix(header, []byte{0x50, 0x4B, 0x03, 0x04}): // ZIP / OOXML
		return "application/zip"
	case bytes.HasPrefix(header, []byte{0xD0, 0xCF, 0x11, 0xE0}): // OLE compound (old doc/ppt)
		return "application/msword"
	}
	lower := strings.ToLower(string(header[:min(len(header), 256)]))
	if strings.Contains(lower, "<svg") || strings.Contains(lower, "<!doctype html") || strings.Contains(lower, "<html") {
		return ""
	}
	return ""
}

func IsImageType(ct string) bool {
	switch ct {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}

func materiAllowed(ct, filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ct {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	case "application/pdf":
		return ext == ".pdf" || ext == ""
	case "application/zip":
		switch ext {
		case ".docx", ".pptx", ".doc", ".ppt", ".xlsx":
			return true
		default:
			return false
		}
	case "application/msword":
		return ext == ".doc" || ext == ".ppt" || ext == ".xls"
	default:
		return false
	}
}

// ValidateImage reads and validates an image upload. Returns a reader of the full content and detected type.
func ValidateImage(r io.Reader, size int64) (io.Reader, string, error) {
	if size <= 0 || size > MaxImageBytes {
		return nil, "", errInvalidImage
	}
	buf, err := io.ReadAll(io.LimitReader(r, MaxImageBytes+1))
	if err != nil {
		return nil, "", errInvalidImage
	}
	if int64(len(buf)) > MaxImageBytes {
		return nil, "", errInvalidImage
	}
	ct := DetectContentType(buf)
	if !IsImageType(ct) {
		return nil, "", errInvalidImage
	}
	return bytes.NewReader(buf), ct, nil
}

// ValidateMateriFile validates materi attachments (images + docs).
func ValidateMateriFile(r io.Reader, filename string, size int64) (io.Reader, string, error) {
	if size <= 0 || size > MaxMateriBytes {
		return nil, "", errInvalidMateri
	}
	buf, err := io.ReadAll(io.LimitReader(r, MaxMateriBytes+1))
	if err != nil {
		return nil, "", errInvalidMateri
	}
	if int64(len(buf)) > MaxMateriBytes {
		return nil, "", errInvalidMateri
	}
	ct := DetectContentType(buf)
	if ct == "" || !materiAllowed(ct, filename) {
		return nil, "", errInvalidMateri
	}
	return bytes.NewReader(buf), ct, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
