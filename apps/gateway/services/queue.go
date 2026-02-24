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
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("unable to connect to redis: %v", err)
	}

	return &QueueService{Client: client}, nil
}

func (q *QueueService) PushTask(ctx context.Context, queue string, payload []byte) error {
	return q.Client.RPush(ctx, queue, payload).Err()
}
