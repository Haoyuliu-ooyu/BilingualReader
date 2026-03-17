package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"gateway/config"
	"gateway/handlers"
	"gateway/migrations"
	"gateway/repository"
	"gateway/services"
)

func main() {
	// Initialize logger
	logger, err := newLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("gateway starting")

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx := context.Background()

	// Connect to database with retry
	var pool *pgxpool.Pool
	for i := 0; i < 10; i++ {
		pool, err = repository.NewPool(ctx, cfg.DBUrl)
		if err == nil {
			logger.Info("connected to database")
			break
		}
		logger.Warn("failed to connect to DB, retrying...",
			zap.Int("attempt", i+1),
			zap.Error(err),
		)
		time.Sleep(2 * time.Second)
	}
	if pool == nil {
		logger.Fatal("could not connect to database after 10 attempts", zap.Error(err))
	}
	defer pool.Close()

	// Run migrations
	if err := runMigrations(cfg.DBUrl, logger); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	// Initialize infrastructure services
	storageService, err := services.NewStorageService(ctx, logger)
	if err != nil {
		logger.Warn("failed to connect to storage", zap.Error(err))
	}

	queueService, err := services.NewQueueService(ctx)
	if err != nil {
		logger.Warn("failed to connect to queue", zap.Error(err))
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(pool)
	docRepo := repository.NewDocumentRepository(pool)
	llmKeyRepo := repository.NewLLMKeyRepository(pool)
	pageRepo := repository.NewPageRepository(pool)

	// Initialize services
	authSvc := services.NewAuthService(userRepo, cfg.JWTSecret)
	docSvc := services.NewDocumentService(docRepo, pageRepo, storageService, llmKeyRepo, queueService, logger)
	uploadSvc := services.NewUploadService(docRepo, llmKeyRepo, storageService, queueService, logger)

	// Initialize health repository (needs direct access to infrastructure clients)
	healthRepo := repository.NewHealthRepository(pool, queueService.Client, storageService.Client, storageService.Bucket)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authSvc, logger)
	docHandler := handlers.NewDocumentHandler(docSvc, logger)
	uploadHandler := handlers.NewUploadHandler(uploadSvc, llmKeyRepo, logger)
	llmKeysHandler := handlers.NewLLMKeysHandler(llmKeyRepo, logger)
	modelsHandler := handlers.NewModelsHandler(llmKeyRepo, logger)
	healthHandler := handlers.NewHealthHandler(healthRepo, logger)

	// Setup router
	r := SetupRouter(cfg, authHandler, docHandler, uploadHandler, llmKeysHandler, modelsHandler, healthHandler, authSvc, logger)

	// Start server
	logger.Info("gateway listening", zap.String("port", cfg.Port))
	if err := r.Run(":" + cfg.Port); err != nil {
		logger.Fatal("failed to run server", zap.Error(err))
	}
}

// newLogger creates a zap logger appropriate for the current environment.
func newLogger() (*zap.Logger, error) {
	mode := os.Getenv("GIN_MODE")
	if mode == "release" {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}

// runMigrations applies database migrations using golang-migrate with embedded SQL files.
func runMigrations(dbURL string, logger *zap.Logger) error {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("creating migration source: %w", err)
	}

	// golang-migrate's pgx5 driver requires the "pgx5://" scheme, but DB_URL
	// uses the standard "postgres://" or "postgresql://" scheme.  Replace it
	// so we don't produce a double-scheme URL like "pgx5://postgres://...".
	migrateURL := dbURL
	if strings.HasPrefix(migrateURL, "postgresql://") {
		migrateURL = "pgx5://" + strings.TrimPrefix(migrateURL, "postgresql://")
	} else if strings.HasPrefix(migrateURL, "postgres://") {
		migrateURL = "pgx5://" + strings.TrimPrefix(migrateURL, "postgres://")
	}

	m, err := migrate.NewWithSourceInstance("iofs", source, migrateURL)
	if err != nil {
		return fmt.Errorf("creating migrator: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("running migrations: %w", err)
	}

	logger.Info("migrations applied successfully")
	return nil
}
