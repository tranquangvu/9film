package stream

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"

	"github.com/bentran/9film/backend/internal/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// statusClientClosed is nginx's 499: the client went away before the response.
// Not an IANA code, but it keeps a viewer's cancelled segment out of the 5xx
// count where a real proxy failure lives.
const statusClientClosed = 499

// gatewayStatus separates an upstream that never answered from one that
// answered badly, so the player (and the log) can tell a stall from a fault.
func gatewayStatus(err error) int {
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return http.StatusGatewayTimeout
	}
	return http.StatusBadGateway
}

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

	result, err := h.hls.ProxyHLS(c.Request.Context(), targetURL)
	if err != nil {
		// A viewer seeking or leaving the page cancels the fetch mid-flight.
		// That's the browser's doing, not a proxy fault, and there's nobody left
		// to read a body — so it's logged quietly under nginx's client-closed code.
		if errors.Is(err, context.Canceled) {
			logger.Get().Debug("HLS request canceled by client", zap.String("url", targetURL))
			c.AbortWithStatus(statusClientClosed)
			return
		}
		logger.Get().Error("HLS proxy failed", zap.String("url", targetURL), zap.Error(err))
		c.JSON(gatewayStatus(err), gin.H{"error": err.Error()})
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
