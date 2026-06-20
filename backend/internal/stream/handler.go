package stream

import (
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler proxies the video-delivery endpoints: stream resolution and HLS
// manifest/segment proxying.
type Handler struct {
	stream Stream
	hls    HLS
}

func NewHandler(stream Stream, hls HLS) *Handler {
	return &Handler{stream: stream, hls: hls}
}

func (h *Handler) GetStream(c *gin.Context) {
	result, err := h.stream.ProxyStreamRequest(c.Request.URL.RawQuery)
	if err != nil {
		logger.Get().Error("stream proxy failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}

func (h *Handler) ForwardHLS(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url query param required"})
		return
	}

	result, err := h.hls.ProxyHLS(targetURL)
	if err != nil {
		logger.Get().Error("HLS proxy failed", zap.String("url", targetURL), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}
