package storage

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveKey(t *testing.T) {
	cases := []struct {
		in, pub string
		want    string
		ok      bool
	}{
		{"/uploads/events/abc.jpg", "", "events/abc.jpg", true},
		{"/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg", "", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg", true},
		{"uploads/checkins/x.jpg", "", "checkins/x.jpg", true},
		{"https://cdn.example.com/events/abc.jpg", "https://cdn.example.com", "events/abc.jpg", true},
		{"https://pub-xxx.r2.dev/checkins/abc.jpg", "https://pub-xxx.r2.dev", "checkins/abc.jpg", true},
		{"events/abc.jpg", "", "events/abc.jpg", true},
		{"../etc/passwd", "", "", false},
		{"", "", "", false},
		{"https://evil.example/../../etc/passwd", "", "", false},
	}
	for _, c := range cases {
		got, ok := resolveKey(c.in, c.pub)
		if ok != c.ok || got != c.want {
			t.Fatalf("resolveKey(%q)=(%q,%v) want (%q,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestOptimizeImageShrinks(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2400, 1800))
	for y := 0; y < 1800; y++ {
		for x := 0; x < 2400; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 255), uint8(y % 255), 80, 255})
		}
	}
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	out, ct, err := OptimizeImage(bytes.NewReader(raw.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if ct != "image/jpeg" {
		t.Fatalf("ct=%s", ct)
	}
	buf, err := ioReadAll(out)
	if err != nil {
		t.Fatal(err)
	}
	if len(buf) > MaxStoredImageBytes {
		t.Fatalf("size %d > %d", len(buf), MaxStoredImageBytes)
	}
	if len(buf) >= raw.Len() {
		t.Fatalf("expected smaller than raw %d, got %d", raw.Len(), len(buf))
	}
	decoded, err := jpeg.Decode(bytes.NewReader(buf))
	if err != nil {
		t.Fatal(err)
	}
	b := decoded.Bounds()
	if b.Dx() > MaxImageSide || b.Dy() > MaxImageSide {
		t.Fatalf("dims %dx%d exceed max", b.Dx(), b.Dy())
	}
}

func TestPutDeleteLocal(t *testing.T) {
	dir := t.TempDir()
	s := &Storage{localDir: dir}
	var pngBuf bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	if err := png.Encode(&pngBuf, img); err != nil {
		t.Fatal(err)
	}
	opt, ct, err := OptimizeImage(bytes.NewReader(pngBuf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	url, err := s.Put(context.Background(), PrefixEvents, "x.png", opt, ct)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(url) == "" {
		t.Fatal("empty url")
	}
	key := url[len("/uploads/"):]
	path := filepath.Join(dir, filepath.FromSlash(key))
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), url); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expected deleted, err=%v", err)
	}
	if err := s.Delete(context.Background(), url); err != nil {
		t.Fatal("idempotent delete failed", err)
	}
}

func ioReadAll(r interface{ Read([]byte) (int, error) }) ([]byte, error) {
	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	return buf.Bytes(), err
}
