package stream

import (
	"io"
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

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

	// Segments stream straight through without buffering; manifests come back as
	// a rewritten Body.
	if result.Stream != nil {
		defer result.Stream.Close()
		c.Header("Content-Type", result.ContentType)
		c.Status(result.Status)
		if _, err := io.Copy(c.Writer, result.Stream); err != nil {
			logger.Get().Warn("HLS segment copy interrupted", zap.String("url", targetURL), zap.Error(err))
		}
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}
