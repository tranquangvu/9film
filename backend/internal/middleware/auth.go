// Package middleware holds gin middleware (currently bearer-token auth).
package middleware

import (
	"net/http"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/auth"
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

const userIDKey = "userID"

// AuthRequired rejects requests without a valid `Authorization: Bearer <jwt>`
// header and stashes the authenticated user id in the gin context.
func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid Authorization header"})
			return
		}

		id, err := auth.Parse(strings.TrimSpace(token), cfg.JWTSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(userIDKey, id)
		c.Next()
	}
}

// UserID returns the authenticated user id set by AuthRequired.
func UserID(c *gin.Context) int64 {
	v, _ := c.Get(userIDKey)
	id, _ := v.(int64)
	return id
}
