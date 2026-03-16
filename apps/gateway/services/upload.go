package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"gateway/models"
	"gateway/repository"
)

// UploadParams holds the parameters for an upload operation.
type UploadParams struct {
	UserID      string
	Filename    string
	TargetLang  string
	LLMProvider string
	LLMModel    string
	LLMApiKey   string // encrypted key
	FileSize    int64
	File        io.Reader
}

// UploadService defines business logic for file uploads.
type UploadService interface {
	Upload(ctx context.Context, params UploadParams) (jobID string, err error)
}

type uploadService struct {
	docRepo    repository.DocumentRepository
	llmKeyRepo repository.LLMKeyRepository
	storage    *StorageService
	queue      *QueueService
	logger     *zap.Logger
}

// NewUploadService creates a new UploadService.
func NewUploadService(
	docRepo repository.DocumentRepository,
	llmKeyRepo repository.LLMKeyRepository,
	storage *StorageService,
	queue *QueueService,
	logger *zap.Logger,
) UploadService {
	return &uploadService{
		docRepo:    docRepo,
		llmKeyRepo: llmKeyRepo,
		storage:    storage,
		queue:      queue,
		logger:     logger,
	}
}

func (s *uploadService) Upload(ctx context.Context, params UploadParams) (string, error) {
	jobID := uuid.New().String()
	s3Key := fmt.Sprintf("%s/%s.pdf", params.UserID, jobID)

	// Upload to S3
	if err := s.storage.UploadFile(ctx, s3Key, params.File); err != nil {
		s.logger.Error("S3 upload failed", zap.Error(err))
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	// Insert document metadata
	if err := s.docRepo.Create(ctx, jobID, params.UserID, params.Filename, params.TargetLang, s3Key, "PENDING", params.LLMProvider, params.LLMModel); err != nil {
		s.logger.Error("DB insert failed", zap.Error(err))
		return "", fmt.Errorf("failed to save metadata: %w", err)
	}

	// Push job to queue
	payload := models.JobPayload{
		JobID:        jobID,
		UserID:       params.UserID,
		S3Key:        s3Key,
		OriginalName: params.Filename,
		TargetLang:   params.TargetLang,
		LLMProvider:  params.LLMProvider,
		LLMApiKey:    params.LLMApiKey,
		LLMModel:     params.LLMModel,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		s.logger.Error("failed to marshal job payload", zap.Error(err))
		return "", fmt.Errorf("failed to create job payload: %w", err)
	}

	if err := s.queue.PushTask(ctx, "tasks:process_pdf", payloadBytes); err != nil {
		s.logger.Error("Redis push failed", zap.Error(err))
		return "", fmt.Errorf("failed to queue job: %w", err)
	}

	return jobID, nil
}

// GetEncryptedKeyFromRepo retrieves a user's encrypted key for a provider from the repository.
func GetEncryptedKeyFromRepo(ctx context.Context, llmKeyRepo repository.LLMKeyRepository, userID, provider string) (string, error) {
	return llmKeyRepo.GetEncryptedKey(ctx, userID, provider)
}
