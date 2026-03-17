package main

import (
	"time"

	"github.com/gin-contrib/cors"
	ginzap "github.com/gin-contrib/zap"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/time/rate"

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
	healthHandler *handlers.HealthHandler,
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
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public health endpoint (no auth required -- accessible to Docker health checks and load balancers)
	r.GET("/health", healthHandler.HandleHealth)

	// Per-IP rate limiter: 10 requests per minute (one token every 6 seconds, burst of 10)
	rateLimiter := handlers.NewIPRateLimiter(rate.Every(6*time.Second), 10)

	api := r.Group("/api")
	{
		// Public auth routes with rate limiting (no JWT required)
		authGroup := api.Group("/auth")
		authGroup.Use(handlers.RateLimitMiddleware(rateLimiter))
		{
			authGroup.POST("/register", authHandler.HandleRegister)
			authGroup.POST("/login", authHandler.HandleLogin)
		}

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
			protected.POST("/documents/:id/retry", docHandler.RetryDocument)
			protected.GET("/llm-keys", llmKeysHandler.HandleListKeys)
			protected.POST("/llm-keys", llmKeysHandler.HandleSaveKey)
			protected.DELETE("/llm-keys/:provider", llmKeysHandler.HandleDeleteKey)
		}
	}

	return r
}
