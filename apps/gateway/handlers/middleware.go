package handlers

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"gateway/services"
)

// IPRateLimiter tracks per-IP rate limiters with automatic cleanup of stale entries.
type IPRateLimiter struct {
	mu       sync.RWMutex
	limiters map[string]*visitorEntry
	rate     rate.Limit
	burst    int
}

type visitorEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewIPRateLimiter creates a rate limiter that allows the given rate and burst per IP.
func NewIPRateLimiter(r rate.Limit, burst int) *IPRateLimiter {
	rl := &IPRateLimiter{
		limiters: make(map[string]*visitorEntry),
		rate:     r,
		burst:    burst,
	}
	go rl.cleanup()
	return rl
}

// Allow checks whether the given IP is within its rate limit.
func (rl *IPRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	v, exists := rl.limiters[ip]
	if !exists {
		v = &visitorEntry{
			limiter:  rate.NewLimiter(rl.rate, rl.burst),
			lastSeen: time.Now(),
		}
		rl.limiters[ip] = v
	}
	v.lastSeen = time.Now()
	rl.mu.Unlock()
	return v.limiter.Allow()
}

// cleanup periodically removes IP entries not seen for over 5 minutes.
func (rl *IPRateLimiter) cleanup() {
	for {
		time.Sleep(3 * time.Minute)
		rl.mu.Lock()
		for ip, v := range rl.limiters {
			if time.Since(v.lastSeen) > 5*time.Minute {
				delete(rl.limiters, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimitMiddleware returns a Gin middleware that rejects requests exceeding the rate limit.
func RateLimitMiddleware(rl *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests,
				gin.H{"error": "Too many requests. Please try again later."})
			return
		}
		c.Next()
	}
}

// AuthRequired is a Gin middleware that validates the JWT from the
// Authorization header and injects userID + email into the context.
func AuthRequired(authSvc services.AuthService) gin.HandlerFunc {
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

		claims, err := authSvc.ValidateToken(parts[1])
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
