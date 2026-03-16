package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/repository"
	"gateway/services"
)

// ModelsHandler handles LLM model listing endpoints.
type ModelsHandler struct {
	llmKeyRepo repository.LLMKeyRepository
	logger     *zap.Logger
}

// ModelsRequest is the request body for listing models.
type ModelsRequest struct {
	Provider string `json:"provider"`
	ApiKey   string `json:"api_key"`
}

// ModelInfo describes a single LLM model.
type ModelInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// NewModelsHandler creates a new ModelsHandler.
func NewModelsHandler(llmKeyRepo repository.LLMKeyRepository, logger *zap.Logger) *ModelsHandler {
	return &ModelsHandler{llmKeyRepo: llmKeyRepo, logger: logger}
}

// HandleListModels lists available models for a given provider.
func (h *ModelsHandler) HandleListModels(c *gin.Context) {
	var req ModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider is required"})
		return
	}

	// If no API key inline, look up saved key
	if req.ApiKey == "" {
		userID := c.GetString("userID")
		encryptedKey, err := h.llmKeyRepo.GetEncryptedKey(c.Request.Context(), userID, req.Provider)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No API key provided and no saved key found for this provider."})
			return
		}
		decrypted, err := services.DecryptAPIKey(encryptedKey)
		if err != nil {
			h.logger.Error("failed to decrypt saved key", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt saved key"})
			return
		}
		req.ApiKey = decrypted
	}

	if req.ApiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_key is required"})
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}

	var models []ModelInfo
	var err error

	switch req.Provider {
	case "openai":
		models, err = fetchOpenAIModels(client, req.ApiKey)
	case "gemini":
		models, err = fetchGeminiModels(client, req.ApiKey)
	case "claude":
		models, err = fetchClaudeModels(client, req.ApiKey)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported provider: %s", req.Provider)})
		return
	}

	if err != nil {
		h.logger.Error("failed to fetch models", zap.String("provider", req.Provider), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"models": models})
}

func fetchOpenAIModels(client *http.Client, apiKey string) ([]ModelInfo, error) {
	req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call OpenAI API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	var models []ModelInfo
	for _, m := range result.Data {
		if strings.HasPrefix(m.ID, "gpt-") ||
			strings.HasPrefix(m.ID, "o1") ||
			strings.HasPrefix(m.ID, "o3") ||
			strings.HasPrefix(m.ID, "o4") ||
			strings.HasPrefix(m.ID, "chatgpt") {
			models = append(models, ModelInfo{ID: m.ID, Name: m.ID})
		}
	}

	return models, nil
}

func fetchGeminiModels(client *http.Client, apiKey string) ([]ModelInfo, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", apiKey)

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to call Gemini API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read Gemini response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Models []struct {
			Name        string `json:"name"`
			DisplayName string `json:"displayName"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	var models []ModelInfo
	for _, m := range result.Models {
		if strings.Contains(strings.ToLower(m.Name), "gemini") {
			id := strings.TrimPrefix(m.Name, "models/")
			name := m.DisplayName
			if name == "" {
				name = id
			}
			models = append(models, ModelInfo{ID: id, Name: name})
		}
	}

	return models, nil
}

func fetchClaudeModels(client *http.Client, apiKey string) ([]ModelInfo, error) {
	req, err := http.NewRequest("GET", "https://api.anthropic.com/v1/models", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := client.Do(req)
	if err != nil {
		return claudeFallbackModels(), nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return claudeFallbackModels(), nil
	}

	if resp.StatusCode != http.StatusOK {
		return claudeFallbackModels(), nil
	}

	var result struct {
		Data []struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return claudeFallbackModels(), nil
	}

	var models []ModelInfo
	for _, m := range result.Data {
		name := m.DisplayName
		if name == "" {
			name = m.ID
		}
		models = append(models, ModelInfo{ID: m.ID, Name: name})
	}

	return models, nil
}

func claudeFallbackModels() []ModelInfo {
	return []ModelInfo{
		{ID: "claude-opus-4-6", Name: "Claude Opus 4.6"},
		{ID: "claude-sonnet-4-6", Name: "Claude Sonnet 4.6"},
		{ID: "claude-haiku-4-5-20251001", Name: "Claude Haiku 4.5"},
	}
}
