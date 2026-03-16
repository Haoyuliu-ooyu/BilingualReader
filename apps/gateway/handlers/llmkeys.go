package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"gateway/repository"
	"gateway/services"
)

// LLMKeysHandler handles LLM API key management endpoints.
type LLMKeysHandler struct {
	llmKeyRepo repository.LLMKeyRepository
	logger     *zap.Logger
}

// SaveKeyRequest is the request body for saving an LLM key.
type SaveKeyRequest struct {
	Provider string `json:"provider" binding:"required"`
	ApiKey   string `json:"api_key" binding:"required"`
}

// NewLLMKeysHandler creates a new LLMKeysHandler.
func NewLLMKeysHandler(llmKeyRepo repository.LLMKeyRepository, logger *zap.Logger) *LLMKeysHandler {
	return &LLMKeysHandler{llmKeyRepo: llmKeyRepo, logger: logger}
}

// HandleSaveKey encrypts and stores (upserts) an API key for the authenticated user.
func (h *LLMKeysHandler) HandleSaveKey(c *gin.Context) {
	userID := c.GetString("userID")

	var req SaveKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider and api_key are required"})
		return
	}

	if req.Provider != "openai" && req.Provider != "gemini" && req.Provider != "claude" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported provider"})
		return
	}

	encrypted, err := services.EncryptAPIKey(req.ApiKey)
	if err != nil {
		h.logger.Error("failed to encrypt API key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt key"})
		return
	}

	keyHint := req.ApiKey[len(req.ApiKey)-4:]
	req.ApiKey = "" // clear plaintext

	err = h.llmKeyRepo.Save(c.Request.Context(), uuid.New().String(), userID, req.Provider, encrypted, keyHint)
	if err != nil {
		h.logger.Error("failed to save LLM key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Key saved"})
}

// HandleListKeys returns which providers the user has saved keys for (no secrets).
func (h *LLMKeysHandler) HandleListKeys(c *gin.Context) {
	userID := c.GetString("userID")

	keys, err := h.llmKeyRepo.ListByUser(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("failed to list LLM keys", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list keys"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"keys": keys})
}

// HandleDeleteKey removes a saved key for a given provider.
func (h *LLMKeysHandler) HandleDeleteKey(c *gin.Context) {
	userID := c.GetString("userID")
	provider := c.Param("provider")

	err := h.llmKeyRepo.Delete(c.Request.Context(), userID, provider)
	if err != nil {
		h.logger.Error("failed to delete LLM key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Key deleted"})
}

// Unused import guard for time package (used in original, keeping for SavedKeyInfo compatibility)
var _ = time.Now
