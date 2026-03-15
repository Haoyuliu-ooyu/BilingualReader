package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"gateway/services"
)

type LLMKeysHandler struct {
	DB *services.DBService
}

type SaveKeyRequest struct {
	Provider string `json:"provider" binding:"required"`
	ApiKey   string `json:"api_key" binding:"required"`
}

type SavedKeyInfo struct {
	Provider  string `json:"provider"`
	KeyHint   string `json:"key_hint"` // last 4 chars
	UpdatedAt string `json:"updated_at"`
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt key"})
		return
	}

	keyHint := req.ApiKey[len(req.ApiKey)-4:]
	req.ApiKey = "" // clear plaintext

	_, err = h.DB.Pool.Exec(c.Request.Context(),
		`INSERT INTO user_llm_keys (id, user_id, provider, encrypted_key, key_hint, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (user_id, provider)
		 DO UPDATE SET encrypted_key = $4, key_hint = $5, updated_at = $6`,
		uuid.New().String(), userID, req.Provider, encrypted, keyHint, time.Now(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Key saved"})
}

// HandleListKeys returns which providers the user has saved keys for (no secrets).
func (h *LLMKeysHandler) HandleListKeys(c *gin.Context) {
	userID := c.GetString("userID")

	rows, err := h.DB.Pool.Query(c.Request.Context(),
		`SELECT provider, key_hint, updated_at FROM user_llm_keys WHERE user_id = $1 ORDER BY provider`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list keys"})
		return
	}
	defer rows.Close()

	keys := []SavedKeyInfo{}
	for rows.Next() {
		var k SavedKeyInfo
		var t time.Time
		if err := rows.Scan(&k.Provider, &k.KeyHint, &t); err != nil {
			continue
		}
		k.UpdatedAt = t.Format(time.RFC3339)
		keys = append(keys, k)
	}

	c.JSON(http.StatusOK, gin.H{"keys": keys})
}

// HandleDeleteKey removes a saved key for a given provider.
func (h *LLMKeysHandler) HandleDeleteKey(c *gin.Context) {
	userID := c.GetString("userID")
	provider := c.Param("provider")

	_, err := h.DB.Pool.Exec(c.Request.Context(),
		`DELETE FROM user_llm_keys WHERE user_id = $1 AND provider = $2`,
		userID, provider,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Key deleted"})
}

// GetEncryptedKey retrieves the encrypted API key for a user+provider from the DB.
func GetEncryptedKey(db *services.DBService, c *gin.Context, userID, provider string) (string, error) {
	var encrypted string
	err := db.Pool.QueryRow(c.Request.Context(),
		`SELECT encrypted_key FROM user_llm_keys WHERE user_id = $1 AND provider = $2`,
		userID, provider,
	).Scan(&encrypted)
	if err != nil {
		return "", err
	}
	return encrypted, nil
}
