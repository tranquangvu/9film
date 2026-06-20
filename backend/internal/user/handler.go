package user

import (
	"errors"
	"net/http"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler serves the auth endpoints (signup/login) and the per-user account
// endpoints (profile, settings).
type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// Signup creates a new account and returns a token.
func (h *Handler) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	email, name, err := normalizeSignup(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, token, err := h.svc.Signup(email, req.Password, name)
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		logger.Get().Warn("signup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": u})
}

// Login verifies credentials and returns a token.
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	u, token, err := h.svc.Login(email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": u})
}

// GetMe returns the authenticated user's profile.
func (h *Handler) GetMe(c *gin.Context) {
	u, err := h.svc.GetUser(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) GetSettings(c *gin.Context) {
	s, err := h.svc.GetSettings(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load settings"})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) PutSettings(c *gin.Context) {
	var s Settings
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	saved, err := h.svc.SaveSettings(middleware.UserID(c), s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save settings"})
		return
	}
	c.JSON(http.StatusOK, saved)
}
