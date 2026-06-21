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

// bearerToken pulls the JWT from the Authorization header, falling back to a
// `?token=` query param for browser-loaded resources (a <track>/<img> element
// can't send custom headers).
func bearerToken(c *gin.Context) string {
	if t, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer "); ok {
		if t = strings.TrimSpace(t); t != "" {
			return t
		}
	}
	return strings.TrimSpace(c.Query("token"))
}

// AuthRequired rejects requests without a valid bearer token and stashes the
// authenticated user id in the gin context.
func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c)
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid Authorization header"})
			return
		}

		id, err := Parse(token, cfg.JWTSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(userIDKey, id)
		c.Next()
	}
}

// AuthOptional stashes the user id when a valid bearer token is present but,
// unlike AuthRequired, never rejects the request.
func AuthOptional(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if token := bearerToken(c); token != "" {
			if id, err := Parse(token, cfg.JWTSecret); err == nil {
				c.Set(userIDKey, id)
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
