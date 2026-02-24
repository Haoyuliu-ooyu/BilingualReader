package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"gateway/handlers"
	"gateway/services"
)

func main() {
	fmt.Println("Gateway Service Starting...")

	ctx := context.Background()

	// Initialize Services
	// Retry loop for DB connection (wait for Postgres to start)
	var dbService *services.DBService
	var err error
	for i := 0; i < 10; i++ {
		dbService, err = services.NewDBService(ctx)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to DB: %v. Retrying in 2s...", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Printf("Critical: Could not connect to DB after retries: %v", err)
	} else {
		defer dbService.Close()
		log.Println("Connected to Database")

		// Create table if not exists (Lazy migration)
		_, err = dbService.Pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS documents (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				original_name TEXT,
				s3_key TEXT,
				status TEXT,
				target_lang TEXT,
				result JSONB,
				created_at TIMESTAMP
			);
		`)
		if err != nil {
			log.Printf("Failed to migrate DB: %v", err)
		}
	}

	storageService, err := services.NewStorageService(ctx)
	if err != nil {
		log.Printf("Warning: Failed to connect to Storage: %v", err)
	}

	queueService, err := services.NewQueueService(ctx)
	if err != nil {
		log.Printf("Warning: Failed to connect to Queue: %v", err)
	}

	// Initialize Handlers
	uploadHandler := &handlers.UploadHandler{
		Storage: storageService,
		DB:      dbService,
		Queue:   queueService,
	}

	// Setup Router
	r := gin.Default()

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // For dev, allow all
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	api := r.Group("/api")
	{
		api.POST("/upload", uploadHandler.HandleUpload)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Gateway listening on port %s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
