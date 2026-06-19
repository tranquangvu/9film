package user

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler serves the auth endpoints (signup/login) and the per-user data
// endpoints (profile, settings, favorites, watch progress, subtitle prefs).
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
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

func (h *Handler) GetFavorites(c *gin.Context) {
	items, err := h.svc.Favorites(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load favorites"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) AddFavorite(c *gin.Context) {
	var req addFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	req.ImdbID = strings.TrimSpace(req.ImdbID)
	if req.ImdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId is required"})
		return
	}
	if req.MediaType != "series" {
		req.MediaType = "movie"
	}
	if err := h.svc.AddFavorite(middleware.UserID(c), req.ImdbID, req.MediaType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to favorites"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"imdbId": req.ImdbID, "mediaType": req.MediaType})
}

func (h *Handler) RemoveFavorite(c *gin.Context) {
	imdbID := strings.TrimSpace(c.Query("imdbId"))
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId is required"})
		return
	}
	if err := h.svc.RemoveFavorite(middleware.UserID(c), imdbID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from favorites"})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetWatching returns the paginated, deduped-per-title resume list —
// with each title's detail embedded — that drives the Continue Watching list.
func (h *Handler) GetWatching(c *gin.Context) {
	limit := 20
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > 50 {
		limit = 50
	}
	offset := 0
	if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
		offset = v
	}

	items, hasMore, nextOffset, err := h.svc.ContinueWatching(middleware.UserID(c), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load continue watching"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      items,
		"hasMore":    hasMore,
		"nextOffset": nextOffset,
	})
}

func (h *Handler) PutProgress(c *gin.Context) {
	var p Progress
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	p.ImdbID = strings.TrimSpace(p.ImdbID)
	if p.ImdbID == "" || p.DurationSeconds <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId and a positive durationSeconds are required"})
		return
	}
	if err := h.svc.UpsertProgress(middleware.UserID(c), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save progress"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *Handler) PutSubtitle(c *gin.Context) {
	var p Subtitle
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	p.ImdbID = strings.TrimSpace(p.ImdbID)
	if p.ImdbID == "" || p.FileID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId and a positive fileId are required"})
		return
	}
	if err := h.svc.UpsertSubtitle(middleware.UserID(c), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save subtitle preference"})
		return
	}
	c.JSON(http.StatusOK, p)
}
