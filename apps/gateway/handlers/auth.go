package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"gateway/services"
)

type AuthHandler struct {
	DB *services.DBService
}

type authRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type authResponse struct {
	Token string   `json:"token"`
	User  userInfo `json:"user"`
}

type userInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// HandleRegister creates a new user account and returns a JWT.
func (h *AuthHandler) HandleRegister(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input. Email and password (min 6 chars) are required."})
		return
	}

	ctx := c.Request.Context()

	// Check if email already exists
	var exists bool
	err := h.DB.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists."})
		return
	}

	// Hash password
	hash, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	// Insert user
	userID := uuid.New().String()
	_, err = h.DB.Pool.Exec(ctx,
		"INSERT INTO users (id, email, password) VALUES ($1, $2, $3)",
		userID, req.Email, hash,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
		return
	}

	// Generate JWT
	token, err := services.GenerateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, authResponse{
		Token: token,
		User:  userInfo{ID: userID, Email: req.Email},
	})
}

// HandleLogin authenticates a user and returns a JWT.
func (h *AuthHandler) HandleLogin(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password are required."})
		return
	}

	ctx := c.Request.Context()

	var userID, hash string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id, password FROM users WHERE email = $1", req.Email,
	).Scan(&userID, &hash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password."})
		return
	}

	if !services.CheckPassword(hash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password."})
		return
	}

	token, err := services.GenerateToken(userID, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		Token: token,
		User:  userInfo{ID: userID, Email: req.Email},
	})
}

// HandleMe returns the current user's info from the JWT context.
func (h *AuthHandler) HandleMe(c *gin.Context) {
	c.JSON(http.StatusOK, userInfo{
		ID:    c.GetString("userID"),
		Email: c.GetString("email"),
	})
}

// Helper used internally — not exported as a handler.
func getUserIDFromContext(ctx context.Context) string {
	// This is a placeholder; the actual userID comes from Gin context
	return ""
}
