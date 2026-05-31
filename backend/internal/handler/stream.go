package handler

import (
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func GetStream() gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := service.ProxyStreamRequest(c.Request.URL.RawQuery)
		if err != nil {
			logger.Get().Error("stream proxy failed", zap.Error(err))
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.Data(result.Status, result.ContentType, result.Body)
	}
}
