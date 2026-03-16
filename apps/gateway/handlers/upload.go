package handlers

import (
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/repository"
	"gateway/services"
)

// UploadHandler handles file upload endpoints.
type UploadHandler struct {
	uploadService services.UploadService
	llmKeyRepo    repository.LLMKeyRepository
	logger        *zap.Logger
}

// NewUploadHandler creates a new UploadHandler.
func NewUploadHandler(uploadSvc services.UploadService, llmKeyRepo repository.LLMKeyRepository, logger *zap.Logger) *UploadHandler {
	return &UploadHandler{uploadService: uploadSvc, llmKeyRepo: llmKeyRepo, logger: logger}
}

// HandleUpload processes a file upload request.
func (h *UploadHandler) HandleUpload(c *gin.Context) {
	userID := c.GetString("userID")

	// Validate file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	if header.Size > 10*1024*1024 { // 10MB limit
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large"})
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext != ".pdf" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only PDF files are allowed"})
		return
	}

	// Parse form fields
	targetLang := c.Query("target_lang")
	if targetLang == "" {
		targetLang = c.PostForm("target_lang")
	}
	if targetLang == "" {
		targetLang = "ES"
	}

	llmProvider := c.Query("llm_provider")
	if llmProvider == "" {
		llmProvider = c.PostForm("llm_provider")
	}

	llmApiKey := c.Query("llm_api_key")
	if llmApiKey == "" {
		llmApiKey = c.PostForm("llm_api_key")
	}

	llmModel := c.Query("llm_model")
	if llmModel == "" {
		llmModel = c.PostForm("llm_model")
	}

	if llmProvider == "" || llmModel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "An LLM provider and model are required. Configure them in Settings."})
		return
	}

	// Resolve encrypted key
	var encryptedKey string
	if llmApiKey != "" {
		encryptedKey, err = services.EncryptAPIKey(llmApiKey)
		if err != nil {
			h.logger.Error("encryption failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure API key"})
			return
		}
		llmApiKey = "" // clear plaintext
	} else {
		// Look up saved key from database (already encrypted)
		encryptedKey, err = h.llmKeyRepo.GetEncryptedKey(c.Request.Context(), userID, llmProvider)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No API key provided and no saved key found for this provider. Configure one in Settings."})
			return
		}
	}

	// Call upload service
	jobID, err := h.uploadService.Upload(c.Request.Context(), services.UploadParams{
		UserID:      userID,
		Filename:    header.Filename,
		TargetLang:  targetLang,
		LLMProvider: llmProvider,
		LLMModel:    llmModel,
		LLMApiKey:   encryptedKey,
		FileSize:    header.Size,
		File:        file,
	})
	if err != nil {
		h.logger.Error("upload failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process upload"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"job_id":  jobID,
	})
}
