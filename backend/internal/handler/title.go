package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

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
func favoritedSet(c *gin.Context, st *store.Store) map[string]struct{} {
	uid := middleware.UserID(c)
	if uid == 0 {
		return nil
	}
	set, err := st.FavoritedSet(uid)
	if err != nil {
		logger.Get().Warn("favorited set lookup failed", zap.Error(err))
		return nil
	}
	return set
}

// markFavorites flags each title the user has favorited (in place; no-op when
// the set is nil, i.e. anonymous).
func markFavorites(set map[string]struct{}, titles []service.ImdbTitle) {
	if set == nil {
		return
	}
	for i := range titles {
		if _, ok := set[titles[i].ID]; ok {
			titles[i].IsFavorite = true
		}
	}
}

func GetTitle(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdbID := c.Param("imdb")
		if imdbID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
			return
		}

		title, err := service.GetTitle(imdbID)
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

		if set := favoritedSet(c, st); set != nil {
			if _, ok := set[title.ID]; ok {
				title.IsFavorite = true
			}
		}
		c.JSON(http.StatusOK, title)
	}
}

func SearchTitles(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := c.Query("q")
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing search query"})
			return
		}

		titles, err := service.SearchTitles(q, parseLimit(c, 20))
		if err != nil {
			logger.Get().Warn("title search failed", zap.String("q", q), zap.Error(err))
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		markFavorites(favoritedSet(c, st), titles)
		c.JSON(http.StatusOK, gin.H{"titles": titles})
	}
}

func GetTrendingTitles(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		titles, err := service.TrendingTitles(parseLimit(c, 10))
		if err != nil {
			logger.Get().Warn("trending titles failed", zap.Error(err))
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		markFavorites(favoritedSet(c, st), titles)
		c.JSON(http.StatusOK, gin.H{"titles": titles})
	}
}

func BrowseTitles(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
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

		result, err := service.BrowseTitles(service.BrowseParams{
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

		markFavorites(favoritedSet(c, st), result.Titles)
		c.JSON(http.StatusOK, result)
	}
}

func GetSimilarTitles(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdbID := c.Param("imdb")
		if imdbID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
			return
		}

		titles, err := service.SimilarTitles(imdbID, parseLimit(c, 6))
		if err != nil {
			logger.Get().Warn("similar titles failed", zap.String("id", imdbID), zap.Error(err))
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		markFavorites(favoritedSet(c, st), titles)
		c.JSON(http.StatusOK, gin.H{"titles": titles})
	}
}
