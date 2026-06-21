package title

import (
	"errors"
	"net/http"
	"strconv"

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

func parseLimit(c *gin.Context, fallback int) int {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(fallback)))
	if err != nil || limit <= 0 {
		return fallback
	}
	if limit > 50 {
		return 50
	}
	return limit
}

func (h *Handler) GetTitle(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	title, err := h.svc.GetTitle(middleware.UserID(c), imdbID)
	if err != nil {
		// An unknown/invalid id is a client-side miss, not an upstream failure —
		// return 404 so callers can show an empty result without a noisy error.
		if errors.Is(err, ErrTitleNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "title not found"})
			return
		}
		logger.Get().Warn("imdb fetch failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, title)
}

func (h *Handler) SearchTitles(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing search query"})
		return
	}

	titles, err := h.svc.SearchTitles(middleware.UserID(c), q, parseLimit(c, 20))
	if err != nil {
		logger.Get().Warn("title search failed", zap.String("q", q), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func (h *Handler) GetTrendingTitles(c *gin.Context) {
	titles, err := h.svc.TrendingTitles(middleware.UserID(c), parseLimit(c, 10))
	if err != nil {
		logger.Get().Warn("trending titles failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func (h *Handler) BrowseTitles(c *gin.Context) {
	first, _ := strconv.Atoi(c.DefaultQuery("first", "20"))
	if first <= 0 {
		first = 20
	}
	if first > 50 {
		first = 50
	}

	var minRating *float64
	if raw := c.Query("minRating"); raw != "" {
		if v, err := strconv.ParseFloat(raw, 64); err == nil {
			minRating = &v
		}
	}

	result, err := h.svc.BrowseTitles(middleware.UserID(c), BrowseParams{
		Type:      c.DefaultQuery("type", ""),
		Genre:     c.Query("genre"),
		First:     first,
		After:     c.Query("after"),
		MinRating: minRating,
		Sort:      c.Query("sort"),
	})
	if err != nil {
		logger.Get().Warn("browse titles failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetSimilarTitles(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	titles, err := h.svc.SimilarTitles(middleware.UserID(c), imdbID, parseLimit(c, 6))
	if err != nil {
		logger.Get().Warn("similar titles failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}
