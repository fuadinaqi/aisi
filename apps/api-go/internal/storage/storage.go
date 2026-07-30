package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
)

type Storage struct { client *s3.Client; bucket, publicURL, localDir string }
func New(c config.Config) (*Storage, error) {
	s := &Storage{bucket: c.R2Bucket, publicURL: c.R2PublicURL, localDir: "uploads"}
	if c.R2AccountID == "" || c.R2Bucket == "" { return s, os.MkdirAll(s.localDir, 0755) }
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(c.R2AccessKeyID, c.R2SecretAccessKey, "")))
	if err != nil { return nil, err }
	s.client = s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String("https://" + c.R2AccountID + ".r2.cloudflarestorage.com") })
	return s, nil
}
func (s *Storage) Put(ctx context.Context, filename string, content io.Reader) (string, error) {
	key := uuid.NewString() + filepath.Ext(filename)
	if s.client == nil {
		path := filepath.Join(s.localDir, key); f, err := os.Create(path); if err != nil { return "", err }; defer f.Close()
		_, err = io.Copy(f, content); return "/uploads/" + key, err
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{Bucket: &s.bucket, Key: &key, Body: content})
	if err != nil { return "", err }; if s.publicURL == "" { return key, nil }; return fmt.Sprintf("%s/%s", s.publicURL, key), nil
}
