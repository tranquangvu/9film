package user

import (
	"net/http"
	"strings"

	"github.com/bentran/9film/backend/internal/logger"
	"github.com/bentran/9film/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetMe(c *gin.Context) {
	u, err := h.svc.GetUser(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

// UpdateMe changes the local account's avatar. The username is deliberately not
// editable — see Service.UpdateAvatar.
func (h *Handler) UpdateMe(c *gin.Context) {
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	u, err := h.svc.UpdateAvatar(middleware.UserID(c), req.Avatar)
	if err != nil {
		logger.Get().Warn("update avatar failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update profile"})
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

// GetCredentials returns the per-user integration key status (never the secrets).
func (h *Handler) GetCredentials(c *gin.Context) {
	st, err := h.svc.CredentialStatus(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load credentials"})
		return
	}
	c.JSON(http.StatusOK, st)
}

// PutCredentials saves the user's integration keys (blank fields are kept).
func (h *Handler) PutCredentials(c *gin.Context) {
	var req updateCredentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	st, err := h.svc.SaveCredentials(middleware.UserID(c), Credentials{
		GeminiAPIKey: strings.TrimSpace(req.GeminiApiKey),
		SubDLAPIKey:  strings.TrimSpace(req.SubdlApiKey),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save credentials"})
		return
	}
	c.JSON(http.StatusOK, st)
}
