package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
)

type StorageService struct {
	Client *s3.Client
	Bucket string
}

func NewStorageService(ctx context.Context, logger *zap.Logger) (*StorageService, error) {
	endpoint := os.Getenv("S3_ENDPOINT")
	region := os.Getenv("S3_REGION")
	bucket := os.Getenv("S3_BUCKET")
	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")

	if bucket == "" {
		bucket = "raw-documents"
	}

	opts := []func(*config.LoadOptions) error{
		config.WithRegion(region),
	}
	// Only use static creds for local Minio — in production, IAM task role handles auth
	if endpoint != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		))
	}
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config, %v", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true // Required for MinIO
		}
	})

	// Only auto-create bucket in local dev (Minio)
	if endpoint != "" {
		_, err = client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucket)})
		if err != nil {
			logger.Info("bucket not found, creating", zap.String("bucket", bucket))
			_, err = client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(bucket)})
			if err != nil {
				if strings.Contains(err.Error(), "BucketAlreadyOwnedByYou") || strings.Contains(err.Error(), "BucketAlreadyExists") {
					logger.Info("bucket already exists", zap.String("bucket", bucket))
				} else {
					return nil, fmt.Errorf("failed to create bucket %s: %v", bucket, err)
				}
			} else {
				logger.Info("bucket created", zap.String("bucket", bucket))
			}
		}
	}

	return &StorageService{
		Client: client,
		Bucket: bucket,
	}, nil
}

func (s *StorageService) UploadFile(ctx context.Context, key string, body io.Reader) error {
	_, err := s.Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
		Body:   body,
	})
	return err
}
