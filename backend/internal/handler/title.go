package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/bentran/nicefilm/backend/internal/shared/middleware"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TitleHandler serves the public IMDb title endpoints (search, trending, browse,
// similar, detail). It carries the store so signed-in requests can be enriched
// with favorite/progress/subtitle state, and the IMDb service for the lookups.
type TitleHandler struct {
	store *store.Store
	imdb  *service.IMDb
}

func NewTitleHandler(st *store.Store, imdb *service.IMDb) *TitleHandler {
	return &TitleHandler{store: st, imdb: imdb}
}

// RegisterRoutes mounts the title routes on the given group (expected to carry
// AuthOptional so signed-in users get the isFavorite flag).
func (h *TitleHandler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/search", h.SearchTitles)
	r.GET("/trending", h.GetTrendingTitles)
	r.GET("/browse", h.BrowseTitles)
	r.GET("/:imdb/similar", h.GetSimilarTitles)
	r.GET("/:imdb", h.GetTitle)
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
func (h *TitleHandler) favoritedSet(c *gin.Context) map[string]struct{} {
	uid := middleware.UserID(c)
	if uid == 0 {
		return nil
	}
	set, err := h.store.FavoritedSet(uid)
	if err != nil {
		logger.Get().Warn("favorited set lookup failed", zap.Error(err))
		return nil
	}
	return set
}

// markFavorites flags each title the user has favorited (in place; no-op when
// the set is nil, i.e. anonymous).
func markFavorites(set map[string]struct{}, titles []service.Title) {
	if set == nil {
		return
	}
	for i := range titles {
		if _, ok := set[titles[i].ID]; ok {
			titles[i].IsFavorite = true
		}
	}
}

func (h *TitleHandler) GetTitle(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	title, err := h.imdb.GetTitle(imdbID)
	if err != nil {
		// An unknown/invalid id is a client-side miss, not an upstream failure —
		// return 404 so callers can show an empty result without a noisy error.
		if errors.Is(err, service.ErrTitleNotFound) {
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
		if set, err := h.store.FavoritedSet(uid); err == nil {
			if _, ok := set[title.ID]; ok {
				title.IsFavorite = true
			}
		}
		if rows, err := h.store.GetTitleProgress(uid, title.ID); err == nil {
			title.Progress = make([]service.TitleProgress, len(rows))
			for i, r := range rows {
				title.Progress[i] = service.TitleProgress{
					Season:          r.Season,
					Episode:         r.Episode,
					PositionSeconds: r.PositionSeconds,
					DurationSeconds: r.DurationSeconds,
					UpdatedAt:       r.UpdatedAt,
				}
			}
		}
		if sub, err := h.store.GetTitleSubtitle(uid, title.ID); err == nil && sub != nil {
			title.SubtitlePref = &service.TitleSubtitle{FileID: sub.FileID, Language: sub.Language}
		}
	}
	c.JSON(http.StatusOK, title)
}

func (h *TitleHandler) SearchTitles(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing search query"})
		return
	}

	titles, err := h.imdb.SearchTitles(q, parseLimit(c, 20))
	if err != nil {
		logger.Get().Warn("title search failed", zap.String("q", q), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func (h *TitleHandler) GetTrendingTitles(c *gin.Context) {
	titles, err := h.imdb.TrendingTitles(parseLimit(c, 10))
	if err != nil {
		logger.Get().Warn("trending titles failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func (h *TitleHandler) BrowseTitles(c *gin.Context) {
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

	result, err := h.imdb.BrowseTitles(service.BrowseParams{
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

func (h *TitleHandler) GetSimilarTitles(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	titles, err := h.imdb.SimilarTitles(imdbID, parseLimit(c, 6))
	if err != nil {
		logger.Get().Warn("similar titles failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	markFavorites(h.favoritedSet(c), titles)
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}
