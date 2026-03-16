package services

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"

	"gateway/repository"
)

// DocumentService defines business logic for document operations.
type DocumentService interface {
	List(ctx context.Context, userID string) ([]repository.DocumentMeta, error)
	GetTree(ctx context.Context, docID, userID string) ([]repository.Page, error)
	GetPDFStream(ctx context.Context, docID, userID string) (io.ReadCloser, int64, error)
	Delete(ctx context.Context, docID, userID string) error
}

type documentService struct {
	docRepo  repository.DocumentRepository
	pageRepo repository.PageRepository
	storage  *StorageService
	logger   *zap.Logger
}

// NewDocumentService creates a new DocumentService.
func NewDocumentService(
	docRepo repository.DocumentRepository,
	pageRepo repository.PageRepository,
	storage *StorageService,
	logger *zap.Logger,
) DocumentService {
	return &documentService{
		docRepo:  docRepo,
		pageRepo: pageRepo,
		storage:  storage,
		logger:   logger,
	}
}

func (s *documentService) List(ctx context.Context, userID string) ([]repository.DocumentMeta, error) {
	return s.docRepo.ListByUser(ctx, userID)
}

func (s *documentService) GetTree(ctx context.Context, docID, userID string) ([]repository.Page, error) {
	// Verify document belongs to user
	_, err := s.docRepo.FindByIDAndUser(ctx, docID, userID)
	if err != nil {
		return nil, fmt.Errorf("document not found")
	}

	return s.pageRepo.GetDocumentTree(ctx, docID)
}

func (s *documentService) GetPDFStream(ctx context.Context, docID, userID string) (io.ReadCloser, int64, error) {
	s3Key, err := s.docRepo.GetS3Key(ctx, docID, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("document not found")
	}

	out, err := s.storage.Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.storage.Bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch PDF from storage: %w", err)
	}

	var contentLength int64
	if out.ContentLength != nil {
		contentLength = *out.ContentLength
	}

	return out.Body, contentLength, nil
}

func (s *documentService) Delete(ctx context.Context, docID, userID string) error {
	s3Key, err := s.docRepo.GetS3Key(ctx, docID, userID)
	if err != nil {
		return fmt.Errorf("document not found")
	}

	// Attempt S3 deletion; log warning on failure but proceed
	_, s3Err := s.storage.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.storage.Bucket),
		Key:    aws.String(s3Key),
	})
	if s3Err != nil {
		s.logger.Warn("failed to delete S3 object, proceeding with DB deletion",
			zap.String("s3_key", s3Key),
			zap.Error(s3Err),
		)
	}

	// Cascade handles children (pages -> segments -> translations)
	return s.docRepo.Delete(ctx, docID)
}
