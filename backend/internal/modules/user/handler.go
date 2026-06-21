package user

import (
	"errors"
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	username, err := normalizeUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, token, err := h.svc.Signup(username)
	if err != nil {
		if errors.Is(err, ErrUsernameTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		logger.Get().Warn("signup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": u})
}

// Login resolves the account by username and returns a token. There is no
// password — this app is local and a correct username is sufficient.
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	username, err := normalizeUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	u, token, err := h.svc.Login(username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unknown username"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": u})
}

func (h *Handler) GetMe(c *gin.Context) {
	u, err := h.svc.GetUser(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

// UpdateMe changes the signed-in user's username and avatar.
func (h *Handler) UpdateMe(c *gin.Context) {
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	username, err := normalizeUsername(req.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.svc.UpdateUser(middleware.UserID(c), username, req.Avatar)
	if err != nil {
		if errors.Is(err, ErrUsernameTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		logger.Get().Warn("update user failed", zap.Error(err))
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
