package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"gateway/models"
	"gateway/services"
)

type UploadHandler struct {
	Storage *services.StorageService
	DB      *services.DBService
	Queue   *services.QueueService
}

func (h *UploadHandler) HandleUpload(c *gin.Context) {
	// 1. Get authenticated user from JWT context
	userID := c.GetString("userID")

	// 2. Validate File
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

	// 3. Generate Metadata
	jobID := uuid.New().String()
<<<<<<< Updated upstream
	userID := c.PostForm("user_id")
	if userID == "" {
		userID = "anonymous"
	}
	targetLang := c.PostForm("target_lang")
=======

	targetLang := c.Query("target_lang")
	if targetLang == "" {
		targetLang = c.PostForm("target_lang")
	}
>>>>>>> Stashed changes
	if targetLang == "" {
		targetLang = "ES" // Default to Spanish
	}

<<<<<<< Updated upstream
=======
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

	// If no API key provided inline, look up the user's saved key
	var encryptedKey string
	if llmApiKey != "" {
		// Encrypt the inline API key (AES-256-GCM)
		encryptedKey, err = services.EncryptAPIKey(llmApiKey)
		if err != nil {
			fmt.Printf("Encryption Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure API key"})
			return
		}
		llmApiKey = "" // clear plaintext from memory
	} else if h.DB != nil {
		// Use saved key from database (already encrypted)
		encryptedKey, err = GetEncryptedKey(h.DB, c, userID, llmProvider)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No API key provided and no saved key found for this provider. Configure one in Settings."})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "An API key is required."})
		return
	}

>>>>>>> Stashed changes
	s3Key := fmt.Sprintf("%s/%s%s", userID, jobID, ext)

	// 4. Upload to S3
	err = h.Storage.UploadFile(c.Request.Context(), s3Key, file)
	if err != nil {
		fmt.Printf("S3 Upload Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file"})
		return
	}

	// 5. Insert into DB
	if h.DB == nil {
		fmt.Println("DB Service is not initialized")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not available"})
		return
	}

	// We need to ensure the schema exists. For now, we assume it does or will.
	_, err = h.DB.Pool.Exec(c.Request.Context(),
		`INSERT INTO documents (id, user_id, original_name, s3_key, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		jobID, userID, header.Filename, s3Key, "PENDING", time.Now(),
	)
	if err != nil {
		// If table doesn't exist, this will fail. We should probably have a migration.
		// For the purpose of this task, we assume infrastructure handles migrations or we do it lazily.
		// Let's just log and error for now.
		fmt.Printf("DB Insert Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save metadata"})
		return
	}

	// 6. Push to Redis
	payload := models.JobPayload{
		JobID:        jobID,
		UserID:       userID,
		S3Key:        s3Key,
		OriginalName: header.Filename,
		TargetLang:   targetLang,
	}

	payloadBytes, _ := json.Marshal(payload)
	err = h.Queue.PushTask(c.Request.Context(), "tasks:process_pdf", payloadBytes)
	if err != nil {
		fmt.Printf("Redis Push Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue job"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"job_id":  jobID,
	})
}
