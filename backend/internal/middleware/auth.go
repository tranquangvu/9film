// Package middleware holds gin middleware (bearer-token auth) plus the auth
// primitives it shares with the user service: JWT issue/parse and password
// hash/verify.
package middleware

import (
	"net/http"
	"strings"

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

		id, err := Parse(strings.TrimSpace(token), cfg.JWTSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(userIDKey, id)
		c.Next()
	}
}

// AuthOptional stashes the user id when a valid bearer token is present but,
// unlike AuthRequired, never rejects the request. Used by public title
// endpoints that enrich responses for signed-in users (e.g. the `isFavorite` flag)
// while staying open to anonymous callers.
func AuthOptional(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if token, ok := strings.CutPrefix(header, "Bearer "); ok {
			if token = strings.TrimSpace(token); token != "" {
				if id, err := Parse(token, cfg.JWTSecret); err == nil {
					c.Set(userIDKey, id)
				}
			}
		}
		c.Next()
	}
}

// UserID returns the authenticated user id set by AuthRequired/AuthOptional
// (0 when the request is anonymous).
func UserID(c *gin.Context) int64 {
	v, _ := c.Get(userIDKey)
	id, _ := v.(int64)
	return id
}
