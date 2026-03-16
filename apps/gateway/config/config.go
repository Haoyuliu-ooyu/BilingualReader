package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds all environment-based configuration for the gateway.
type Config struct {
	DBUrl                string
	RedisAddr            string
	S3Endpoint           string
	S3Region             string
	S3Bucket             string
	AWSAccessKey         string
	AWSSecretKey         string
	JWTSecret            string
	LLMKeyEncryptionSecret string
	Port                 string
	AllowedOrigins       []string
	GinMode              string
}

// LoadConfig reads configuration from environment variables and validates required fields.
func LoadConfig() (*Config, error) {
	cfg := &Config{
		DBUrl:                getEnv("DB_URL", "postgres://postgres:prism@localhost:5432/prism?sslmode=disable"),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		S3Endpoint:           os.Getenv("S3_ENDPOINT"),
		S3Region:             os.Getenv("S3_REGION"),
		S3Bucket:             getEnv("S3_BUCKET", "raw-documents"),
		AWSAccessKey:         os.Getenv("AWS_ACCESS_KEY_ID"),
		AWSSecretKey:         os.Getenv("AWS_SECRET_ACCESS_KEY"),
		JWTSecret:            os.Getenv("JWT_SECRET"),
		LLMKeyEncryptionSecret: os.Getenv("LLM_KEY_ENCRYPTION_SECRET"),
		Port:                 getEnv("PORT", "8080"),
		GinMode:              os.Getenv("GIN_MODE"),
	}

	// Parse ALLOWED_ORIGINS
	originsRaw := os.Getenv("ALLOWED_ORIGINS")
	if originsRaw == "" {
		return nil, fmt.Errorf("ALLOWED_ORIGINS must be set (comma-separated list of allowed origins)")
	}

	parts := strings.Split(originsRaw, ",")
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			cfg.AllowedOrigins = append(cfg.AllowedOrigins, trimmed)
		}
	}

	if len(cfg.AllowedOrigins) == 0 {
		return nil, fmt.Errorf("ALLOWED_ORIGINS must be set (comma-separated list of allowed origins)")
	}

	// Validate JWT secret minimum length
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters (got %d)", len(cfg.JWTSecret))
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
