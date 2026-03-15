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

		// Create tables if not exists (Lazy migration)
		_, err = dbService.Pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS users (
				id         TEXT PRIMARY KEY,
				email      TEXT UNIQUE NOT NULL,
				password   TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT NOW()
			);
		`)
		if err != nil {
			log.Printf("Failed to migrate users table: %v", err)
		}

		_, err = dbService.Pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS documents (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				original_name TEXT,
				s3_key TEXT,
				status TEXT,
				target_lang TEXT,
				result JSONB,
				llm_provider TEXT,
				llm_model TEXT,
				created_at TIMESTAMP
			);
		`)
		if err != nil {
			log.Printf("Failed to migrate DB: %v", err)
		}
		// Add columns if they don't exist (for existing DBs)
		dbService.Pool.Exec(ctx, `ALTER TABLE documents ADD COLUMN IF NOT EXISTS llm_provider TEXT`)
		dbService.Pool.Exec(ctx, `ALTER TABLE documents ADD COLUMN IF NOT EXISTS llm_model TEXT`)

		_, err = dbService.Pool.Exec(ctx, `
			CREATE TABLE IF NOT EXISTS user_llm_keys (
				id           TEXT PRIMARY KEY,
				user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				provider     TEXT NOT NULL,
				encrypted_key TEXT NOT NULL,
				key_hint     TEXT NOT NULL DEFAULT '',
				updated_at   TIMESTAMP DEFAULT NOW(),
				UNIQUE(user_id, provider)
			);
		`)
		if err != nil {
			log.Printf("Failed to migrate user_llm_keys table: %v", err)
		}
		dbService.Pool.Exec(ctx, `ALTER TABLE user_llm_keys ADD COLUMN IF NOT EXISTS key_hint TEXT NOT NULL DEFAULT ''`)
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

	documentHandler := &handlers.DocumentHandler{
		DB:      dbService,
		Storage: storageService,
	}

	modelsHandler := &handlers.ModelsHandler{
		DB: dbService,
	}

	llmKeysHandler := &handlers.LLMKeysHandler{
		DB: dbService,
	}

	authHandler := &handlers.AuthHandler{
		DB: dbService,
	}

	// Setup Router
	r := gin.Default()

	// CORS Setup
	// TODO: For production, replace AllowOrigins with your actual domain.
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false, // Must be false when AllowOrigins is "*"
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	api := r.Group("/api")
	{
		// Public auth routes (no JWT required)
		api.POST("/auth/register", authHandler.HandleRegister)
		api.POST("/auth/login", authHandler.HandleLogin)

		// Protected routes (JWT required)
		protected := api.Group("")
		protected.Use(handlers.AuthRequired())
		{
			protected.GET("/auth/me", authHandler.HandleMe)
			protected.POST("/upload", uploadHandler.HandleUpload)
			protected.POST("/models", modelsHandler.HandleListModels)
			protected.GET("/documents", documentHandler.GetDocumentsList)
			protected.GET("/documents/:id", documentHandler.GetDocumentTree)
			protected.GET("/documents/:id/pdf", documentHandler.GetDocumentPDF)
			protected.DELETE("/documents/:id", documentHandler.DeleteDocument)
			protected.GET("/llm-keys", llmKeysHandler.HandleListKeys)
			protected.POST("/llm-keys", llmKeysHandler.HandleSaveKey)
			protected.DELETE("/llm-keys/:provider", llmKeysHandler.HandleDeleteKey)
		}
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
