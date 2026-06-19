package handler

import (
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// StreamHandler proxies the upstream stream-resolution request.
type StreamHandler struct {
	stream *service.Stream
}

func NewStreamHandler(stream *service.Stream) *StreamHandler {
	return &StreamHandler{stream: stream}
}

func (h *StreamHandler) GetStream(c *gin.Context) {
	result, err := h.stream.ProxyStreamRequest(c.Request.URL.RawQuery)
	if err != nil {
		logger.Get().Error("stream proxy failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}
