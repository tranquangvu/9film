package handler

import (
	"net/http"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HLSHandler proxies HLS manifests/segments, rewriting URIs back through itself.
type HLSHandler struct {
	hls *service.HLS
}

func NewHLSHandler(hls *service.HLS) *HLSHandler {
	return &HLSHandler{hls: hls}
}

func (h *HLSHandler) ForwardHLS(c *gin.Context) {
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
