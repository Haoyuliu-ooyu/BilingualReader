package services

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/redis/go-redis/v9"
)

// QueueService abstracts over Redis and SQS queue backends.
type QueueService struct {
	Driver      string // "redis" or "sqs"
	RedisClient *redis.Client
	sqsClient   *sqs.Client
	sqsQueueURL string
}

func NewQueueService(ctx context.Context) (*QueueService, error) {
	driver := os.Getenv("QUEUE_DRIVER")
	if driver == "" {
		driver = "redis"
	}

	qs := &QueueService{Driver: driver}

	switch driver {
	case "sqs":
		queueURL := os.Getenv("SQS_QUEUE_URL")
		if queueURL == "" {
			return nil, fmt.Errorf("SQS_QUEUE_URL must be set when QUEUE_DRIVER=sqs")
		}

		cfg, err := awsconfig.LoadDefaultConfig(ctx)
		if err != nil {
			return nil, fmt.Errorf("unable to load AWS config: %v", err)
		}

		qs.sqsClient = sqs.NewFromConfig(cfg)
		qs.sqsQueueURL = queueURL

	case "redis":
		url := os.Getenv("REDIS_URL")
		if url == "" {
			url = "redis://localhost:6379/0"
		}

		opts, err := redis.ParseURL(url)
		if err != nil {
			return nil, fmt.Errorf("invalid REDIS_URL: %v", err)
		}

		client := redis.NewClient(opts)
		if err := client.Ping(ctx).Err(); err != nil {
			return nil, fmt.Errorf("unable to connect to redis: %v", err)
		}

		qs.RedisClient = client

	default:
		return nil, fmt.Errorf("unknown QUEUE_DRIVER: %s (expected 'redis' or 'sqs')", driver)
	}

	return qs, nil
}

func (q *QueueService) PushTask(ctx context.Context, queue string, payload []byte) error {
	switch q.Driver {
	case "sqs":
		_, err := q.sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
			QueueUrl:    aws.String(q.sqsQueueURL),
			MessageBody: aws.String(string(payload)),
		})
		return err
	default:
		return q.RedisClient.RPush(ctx, queue, payload).Err()
	}
}
