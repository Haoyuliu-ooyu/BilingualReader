package services

import (
	"context"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

type QueueService struct {
	Client *redis.Client
}

func NewQueueService(ctx context.Context) (*QueueService, error) {
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

	return &QueueService{Client: client}, nil
}

func (q *QueueService) PushTask(ctx context.Context, queue string, payload []byte) error {
	return q.Client.RPush(ctx, queue, payload).Err()
}
