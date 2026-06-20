package favorite

import (
	"net/http"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
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
