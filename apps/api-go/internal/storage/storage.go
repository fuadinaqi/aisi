package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
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

type Storage struct {
	client                    *s3.Client
	bucket, publicURL, localDir string
}

func New(c config.Config) (*Storage, error) {
	s := &Storage{bucket: c.R2Bucket, publicURL: c.R2PublicURL, localDir: "uploads"}
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

// Put stores content. contentType should be detected server-side; empty falls back to application/octet-stream.
func (s *Storage) Put(ctx context.Context, filename string, content io.Reader, contentType string) (string, error) {
	ext := filepath.Ext(filename)
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
	}
	key := uuid.NewString() + ext
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if s.client == nil {
		path := filepath.Join(s.localDir, key)
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
