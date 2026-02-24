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
	// 1. Validate File
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

	// 2. Generate Metadata
	jobID := uuid.New().String()
	userID := c.PostForm("user_id")
	if userID == "" {
		userID = "anonymous"
	}
	targetLang := c.PostForm("target_lang")
	if targetLang == "" {
		targetLang = "ES" // Default to Spanish
	}

	s3Key := fmt.Sprintf("%s/%s%s", userID, jobID, ext)

	// 3. Upload to S3
	err = h.Storage.UploadFile(c.Request.Context(), s3Key, file)
	if err != nil {
		fmt.Printf("S3 Upload Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file"})
		return
	}

	// 4. Insert into DB (Table definition assumed: documents)
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

	// 5. Push to Redis
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
