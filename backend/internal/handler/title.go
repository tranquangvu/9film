package handler

import (
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
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

func GetTitle(c *gin.Context) {
	imdbID := c.Param("imdb")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	title, err := service.GetTitle(imdbID)
	if err != nil {
		logger.Get().Warn("imdb fetch failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, title)
}

func SearchTitles(c *gin.Context) {
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
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func GetTrendingTitles(c *gin.Context) {
	titles, err := service.TrendingTitles(parseLimit(c, 10))
	if err != nil {
		logger.Get().Warn("trending titles failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}

func BrowseTitles(c *gin.Context) {
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

	c.JSON(http.StatusOK, result)
}

func GetSimilarTitles(c *gin.Context) {
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
	c.JSON(http.StatusOK, gin.H{"titles": titles})
}
