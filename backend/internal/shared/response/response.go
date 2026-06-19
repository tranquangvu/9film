// Package response holds small JSON-rendering helpers for gin handlers, so
// handlers can write consistent success/error envelopes.
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OK writes data as a 200 response.
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, data)
}

// Created writes data as a 201 response.
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, data)
}

// Error writes {"error": msg} with the given status.
func Error(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

// Items writes {"items": items} as a 200 response.
func Items(c *gin.Context, items any) {
	c.JSON(http.StatusOK, gin.H{"items": items})
}
