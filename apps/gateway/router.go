package main

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	ginzap "github.com/gin-contrib/zap"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/config"
	"gateway/handlers"
	"gateway/services"
)

// SetupRouter creates and configures the Gin engine with all routes and middleware.
func SetupRouter(
	cfg *config.Config,
	authHandler *handlers.AuthHandler,
	docHandler *handlers.DocumentHandler,
	uploadHandler *handlers.UploadHandler,
	llmKeysHandler *handlers.LLMKeysHandler,
	modelsHandler *handlers.ModelsHandler,
	authService services.AuthService,
	logger *zap.Logger,
) *gin.Engine {
	r := gin.New()

	// Structured request logging and panic recovery via zap
	r.Use(ginzap.Ginzap(logger, time.RFC3339, true))
	r.Use(ginzap.RecoveryWithZap(logger, true))

	// CORS -- must be registered before route groups (pitfall 5)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// Public health endpoint (placeholder -- Plan 03 upgrades this)
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
		protected.Use(handlers.AuthRequired(authService))
		{
			protected.GET("/auth/me", authHandler.HandleMe)
			protected.POST("/upload", uploadHandler.HandleUpload)
			protected.POST("/models", modelsHandler.HandleListModels)
			protected.GET("/documents", docHandler.GetDocumentsList)
			protected.GET("/documents/:id", docHandler.GetDocumentTree)
			protected.GET("/documents/:id/pdf", docHandler.GetDocumentPDF)
			protected.DELETE("/documents/:id", docHandler.DeleteDocument)
			protected.GET("/llm-keys", llmKeysHandler.HandleListKeys)
			protected.POST("/llm-keys", llmKeysHandler.HandleSaveKey)
			protected.DELETE("/llm-keys/:provider", llmKeysHandler.HandleDeleteKey)
		}
	}

	return r
}
