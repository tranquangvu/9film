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

// Enricher supplies per-user state (favorites, progress, subtitle preference)
// used to enrich title responses for signed-in requests. It is implemented in
// the user package (backed by the user repository) so the title module never
// imports user — keeping the dependency direction one-way.
type Enricher interface {
	FavoritedIds(userID int64) map[string]struct{}
	IsFavorited(userID int64, imdbID string) bool
	Progress(userID int64, imdbID string) []TitleProgress
}

// Handler serves the public IMDb title endpoints (search, trending, browse,
// similar, detail). It carries the title service for lookups and an Enricher so
// signed-in requests can be enriched with favorite/progress/subtitle state.
type Handler struct {
	svc      Service
	enricher Enricher
}

func NewHandler(svc Service, enricher Enricher) *Handler {
	return &Handler{svc: svc, enricher: enricher}
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

// favoritedSet returns the requesting user's favorited imdb ids, or nil when the
// request is anonymous (AuthOptional left no user) or the lookup fails.
func (h *Handler) favoritedSet(c *gin.Context) map[string]struct{} {
	uid := middleware.UserID(c)
	if uid == 0 {
		return nil
	}
	return h.enricher.FavoritedIds(uid)
}

// markFavorites flags each title the user has favorited (in place; no-op when
// the set is nil, i.e. anonymous).
func markFavorites(set map[string]struct{}, titles []Title) {
	if set == nil {
		return
	}
	for i := range titles {
		if _, ok := set[titles[i].ID]; ok {
			titles[i].IsFavorite = true
		}
	}
}

func (h *Handler) GetTitle(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	title, err := h.svc.GetTitle(imdbID)
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

	// For signed-in users, fold in their favorite flag and per-title resume
	// points so the detail/watch pages don't need separate /favorites or
	// /progress calls.
	if uid := middleware.UserID(c); uid != 0 {
		title.IsFavorite = h.enricher.IsFavorited(uid, title.ID)
		if rows := h.enricher.Progress(uid, title.ID); rows != nil {
			title.Progress = rows
		}
	}
	c.JSON(http.StatusOK, title)
}

func (h *Handler) SearchTitles(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing search query"})
		return
	}

	titles, err := h.svc.SearchTitles(q, parseLimit(c, 20))
	if err != nil {
		logger.Get().Warn("title search failed", zap.String("q", q), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func (h *Handler) GetTrendingTitles(c *gin.Context) {
	titles, err := h.svc.TrendingTitles(parseLimit(c, 10))
	if err != nil {
		logger.Get().Warn("trending titles failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
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

	result, err := h.svc.BrowseTitles(BrowseParams{
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

	markFavorites(h.favoritedSet(c), result.Titles)
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetSimilarTitles(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	titles, err := h.svc.SimilarTitles(imdbID, parseLimit(c, 6))
	if err != nil {
		logger.Get().Warn("similar titles failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}
