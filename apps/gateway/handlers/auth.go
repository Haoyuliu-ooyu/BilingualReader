package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"gateway/services"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService services.AuthService
	logger      *zap.Logger
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

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authSvc services.AuthService, logger *zap.Logger) *AuthHandler {
	return &AuthHandler{authService: authSvc, logger: logger}
}

// HandleRegister creates a new user account and returns a JWT.
func (h *AuthHandler) HandleRegister(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input. Email and password (min 6 chars) are required."})
		return
	}

	token, userID, err := h.authService.Register(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		h.logger.Warn("registration failed", zap.String("email", req.Email), zap.Error(err))
		// Check for duplicate email
		if err.Error() == "an account with this email already exists" {
			c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account"})
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

	token, userID, userEmail, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		h.logger.Warn("login failed", zap.String("email", req.Email), zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password."})
		return
	}

	c.JSON(http.StatusOK, authResponse{
		Token: token,
		User:  userInfo{ID: userID, Email: userEmail},
	})
}

// HandleMe returns the current user's info from the JWT context.
func (h *AuthHandler) HandleMe(c *gin.Context) {
	c.JSON(http.StatusOK, userInfo{
		ID:    c.GetString("userID"),
		Email: c.GetString("email"),
	})
}
