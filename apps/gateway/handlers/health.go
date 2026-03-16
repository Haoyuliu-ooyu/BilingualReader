package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/repository"
)

// HealthHandler handles the health check endpoint.
type HealthHandler struct {
	healthRepo repository.HealthRepository
	logger     *zap.Logger
}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler(healthRepo repository.HealthRepository, logger *zap.Logger) *HealthHandler {
	return &HealthHandler{healthRepo: healthRepo, logger: logger}
}

// HealthStatus represents the JSON response for the health endpoint.
type HealthStatus struct {
	Status   string            `json:"status"`
	Services map[string]string `json:"services"`
}

// HandleHealth checks DB, Redis, and S3 connectivity and returns per-dependency status.
// Returns 200 when all healthy, 503 when any dependency is degraded.
func (h *HealthHandler) HandleHealth(c *gin.Context) {
	ctx := c.Request.Context()
	services := make(map[string]string)
	allHealthy := true

	// Check DB
	if err := h.healthRepo.PingDB(ctx); err != nil {
		services["database"] = "unhealthy"
		allHealthy = false
		h.logger.Error("health check: database unhealthy", zap.Error(err))
	} else {
		services["database"] = "healthy"
	}

	// Check Redis
	if err := h.healthRepo.PingRedis(ctx); err != nil {
		services["redis"] = "unhealthy"
		allHealthy = false
		h.logger.Error("health check: redis unhealthy", zap.Error(err))
	} else {
		services["redis"] = "healthy"
	}

	// Check S3
	if err := h.healthRepo.PingS3(ctx); err != nil {
		services["storage"] = "unhealthy"
		allHealthy = false
		h.logger.Error("health check: storage unhealthy", zap.Error(err))
	} else {
		services["storage"] = "healthy"
	}

	status := "healthy"
	statusCode := http.StatusOK
	if !allHealthy {
		status = "degraded"
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, HealthStatus{Status: status, Services: services})
}
