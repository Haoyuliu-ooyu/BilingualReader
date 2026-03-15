package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"gateway/services"
)

// AuthRequired is a Gin middleware that validates the JWT from the
// Authorization header and injects userID + email into the context.
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			return
		}

		// Expect "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be: Bearer <token>"})
			return
		}

		claims, err := services.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Store user info in Gin context for downstream handlers
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)

		c.Next()
	}
}
