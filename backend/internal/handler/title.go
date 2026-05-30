package handler

import (
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func GetTitle(c *gin.Context) {
	imdbID := c.Param("id")
	if imdbID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing title id"})
		return
	}

	title, err := service.FetchTitle(imdbID)
	if err != nil {
		logger.Get().Warn("imdb fetch failed", zap.String("id", imdbID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, title)
}
