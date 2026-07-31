package storage

import (
	"bytes"
	"errors"
	"image/jpeg"
	_ "image/gif"
	_ "image/png"
	"io"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
)

const (
	MaxImageSide        = 1600
	MaxStoredImageBytes = 1536 << 10 // 1.5 MB
	jpegQualityStart    = 80
	jpegQualityFloor    = 60
)

var errOptimizeImage = errors.New("Gagal mengoptimalkan gambar")
var errStoredImageTooLarge = errors.New("Gambar setelah optimasi masih melebihi 1.5MB")

// OptimizeImage resizes to max 1600px and re-encodes as JPEG (quality 80→60).
// GIF/WebP decode to a single frame. Output content type is always image/jpeg.
func OptimizeImage(r io.Reader) (io.Reader, string, error) {
	img, err := imaging.Decode(r, imaging.AutoOrientation(true))
	if err != nil {
		return nil, "", errOptimizeImage
	}
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w > MaxImageSide || h > MaxImageSide {
		img = imaging.Fit(img, MaxImageSide, MaxImageSide, imaging.Lanczos)
	}
	for q := jpegQualityStart; q >= jpegQualityFloor; q -= 10 {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}); err != nil {
			return nil, "", errOptimizeImage
		}
		if buf.Len() <= MaxStoredImageBytes {
			return bytes.NewReader(buf.Bytes()), "image/jpeg", nil
		}
	}
	return nil, "", errStoredImageTooLarge
}
