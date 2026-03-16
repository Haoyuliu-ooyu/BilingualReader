package repository

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type healthRepo struct {
	pool   *pgxpool.Pool
	redis  *redis.Client
	s3     *s3.Client
	bucket string
}

// NewHealthRepository creates a HealthRepository that pings DB, Redis, and S3.
func NewHealthRepository(pool *pgxpool.Pool, redisClient *redis.Client, s3Client *s3.Client, bucket string) HealthRepository {
	return &healthRepo{pool: pool, redis: redisClient, s3: s3Client, bucket: bucket}
}

func (r *healthRepo) PingDB(ctx context.Context) error {
	return r.pool.Ping(ctx)
}

func (r *healthRepo) PingRedis(ctx context.Context) error {
	return r.redis.Ping(ctx).Err()
}

func (r *healthRepo) PingS3(ctx context.Context) error {
	_, err := r.s3.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(r.bucket)})
	return err
}
