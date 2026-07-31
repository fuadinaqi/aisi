package storage

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/google/uuid"
)

const (
	PrefixEvents      = "events/"
	PrefixCheckins    = "checkins/"
	PrefixEvaluations = "evaluations/"
	PrefixMateri      = "materi/"
)

type Storage struct {
	client                      *s3.Client
	bucket, publicURL, localDir string
}

func New(c config.Config) (*Storage, error) {
	s := &Storage{bucket: c.R2Bucket, publicURL: strings.TrimRight(c.R2PublicURL, "/"), localDir: "uploads"}
	if c.R2AccountID == "" || c.R2Bucket == "" {
		return s, os.MkdirAll(s.localDir, 0755)
	}
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(c.R2AccessKeyID, c.R2SecretAccessKey, "")))
	if err != nil {
		return nil, err
	}
	s.client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String("https://" + c.R2AccountID + ".r2.cloudflarestorage.com")
	})
	return s, nil
}

func normalizePrefix(prefix string) string {
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		return ""
	}
	return prefix + "/"
}

// Put stores content under {prefix}{uuid}{ext}. contentType should be detected server-side.
// filename is used for extension when content type does not imply one (e.g. OOXML zip).
func (s *Storage) Put(ctx context.Context, prefix, filename string, content io.Reader, contentType string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if contentType != "" {
		switch contentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		case "image/webp":
			ext = ".webp"
		case "application/pdf":
			ext = ".pdf"
		}
	} else {
		contentType = "application/octet-stream"
	}
	if ext == "" {
		ext = ".bin"
	}
	key := normalizePrefix(prefix) + uuid.NewString() + ext
	if s.client == nil {
		path := filepath.Join(s.localDir, filepath.FromSlash(key))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return "", err
		}
		f, err := os.Create(path)
		if err != nil {
			return "", err
		}
		defer f.Close()
		_, err = io.Copy(f, content)
		return "/uploads/" + key, err
	}
	input := &s3.PutObjectInput{
		Bucket:      &s.bucket,
		Key:         &key,
		Body:        content,
		ContentType: &contentType,
	}
	if !IsImageType(contentType) {
		disp := "attachment"
		input.ContentDisposition = &disp
	}
	_, err := s.client.PutObject(ctx, input)
	if err != nil {
		return "", err
	}
	if s.publicURL == "" {
		return key, nil
	}
	return fmt.Sprintf("%s/%s", s.publicURL, key), nil
}

// Delete removes an object by URL returned from Put, /uploads/… path, or raw key. Missing object is nil.
func (s *Storage) Delete(ctx context.Context, urlOrKey string) error {
	key, ok := resolveKey(urlOrKey, s.publicURL)
	if !ok {
		return nil
	}
	if s.client == nil {
		path := filepath.Join(s.localDir, filepath.FromSlash(key))
		err := os.Remove(path)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: &s.bucket,
		Key:    &key,
	})
	return err
}

// DeleteBestEffort deletes and logs failures without returning them.
func (s *Storage) DeleteBestEffort(ctx context.Context, urlOrKey string) {
	if urlOrKey == "" {
		return
	}
	if err := s.Delete(ctx, urlOrKey); err != nil {
		log.Printf("storage: gagal hapus %s: %v", urlOrKey, err)
	}
}

func resolveKey(urlOrKey, publicURL string) (string, bool) {
	raw := strings.TrimSpace(urlOrKey)
	if raw == "" {
		return "", false
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil {
			return "", false
		}
		raw = strings.TrimPrefix(u.Path, "/")
		if publicURL != "" {
			if pu, err := url.Parse(publicURL); err == nil {
				prefix := strings.Trim(pu.Path, "/")
				if prefix != "" && strings.HasPrefix(raw, prefix+"/") {
					raw = strings.TrimPrefix(raw, prefix+"/")
				}
			}
		}
	} else {
		raw = strings.TrimPrefix(raw, "/uploads/")
		raw = strings.TrimPrefix(raw, "uploads/")
		raw = strings.TrimPrefix(raw, "/")
	}
	raw = strings.TrimPrefix(raw, "/")
	if raw == "" || strings.Contains(raw, "..") || strings.HasPrefix(raw, `\`) {
		return "", false
	}
	// Allow only safe key chars: alnum, dash, underscore, slash, dot
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '/' || r == '.' {
			continue
		}
		return "", false
	}
	return raw, true
}

// UploadFileServer serves local uploads with nosniff and attachment for non-images.
func UploadFileServer(dir string) http.Handler {
	inner := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		name := filepath.Base(r.URL.Path)
		ext := strings.ToLower(filepath.Ext(name))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".gif", ".webp":
			// inline OK
		default:
			w.Header().Set("Content-Disposition", "attachment; filename=\""+name+"\"")
		}
		inner.ServeHTTP(w, r)
	})
}
