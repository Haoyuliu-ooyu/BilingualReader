package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/repository"
	"gateway/services"
)

const maxUploadSize int64 = 50 * 1024 * 1024 // 50 MB

// validFilenameRegex: alphanumeric start, then alphanumeric, dots, hyphens, underscores, spaces. Max 255 chars.
var validFilenameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._\- ]{0,254}$`)

func isValidFilename(name string) bool {
	return validFilenameRegex.MatchString(name)
}

// allowedLanguages is a BCP-47 language code whitelist.
var allowedLanguages = map[string]bool{
	"en": true, "zh": true, "zhh": true, "ja": true, "ko": true,
	"fr": true, "de": true, "es": true, "pt": true,
	"it": true, "ru": true, "ar": true, "hi": true,
	"th": true, "vi": true, "nl": true, "pl": true,
	"sv": true, "da": true, "fi": true, "no": true,
	"tr": true, "id": true, "ms": true, "uk": true,
}

func isValidLanguageCode(code string) bool {
	return allowedLanguages[strings.ToLower(code)]
}

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

	// Enforce 50 MB file size limit
	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("File too large. Maximum size is 50 MB, got %d MB.", header.Size/(1024*1024))})
		return
	}

	// Validate filename characters
	if !isValidFilename(header.Filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename. Use only letters, numbers, dots, hyphens, underscores, and spaces."})
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

	// Validate language code
	if !isValidLanguageCode(targetLang) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Unsupported language code: %s. Supported: en, zh, zhh, ja, ko, fr, de, es, pt, it, ru, ar, hi, th, vi, nl, pl, sv, da, fi, no, tr, id, ms, uk.", targetLang)})
		return
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

	// Validate LLM provider
	if llmProvider != "openai" && llmProvider != "gemini" && llmProvider != "claude" {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Unsupported LLM provider: %s. Use openai, gemini, or claude.", llmProvider)})
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
