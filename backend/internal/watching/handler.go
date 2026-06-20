package watching

import (
	"net/http"
	"strconv"
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
