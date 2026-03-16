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
	// Verify ownership and get S3 key
	s3Key, err := s.docRepo.GetS3Key(ctx, docID, userID)
	if err != nil {
		return fmt.Errorf("document not found: %w", err)
	}

	// Attempt S3 cleanup (best effort -- orphaned object is acceptable)
	if s3Key != "" {
		_, err = s.storage.Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(s.storage.Bucket),
			Key:    aws.String(s3Key),
		})
		if err != nil {
			s.logger.Warn("failed to delete S3 object, orphaned object may remain",
				zap.String("s3_key", s3Key),
				zap.String("doc_id", docID),
				zap.Error(err),
			)
			// Continue with DB deletion per design decision
		}
	}

	// Delete from DB (CASCADE handles child tables: pages -> segments -> translations)
	if err := s.docRepo.Delete(ctx, docID); err != nil {
		return fmt.Errorf("failed to delete document from database: %w", err)
	}

	s.logger.Info("document deleted",
		zap.String("doc_id", docID),
		zap.String("user_id", userID),
	)
	return nil
}
