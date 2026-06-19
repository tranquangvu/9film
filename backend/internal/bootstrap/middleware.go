package bootstrap

import (
	"bytes"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// errorBodyWriter captures small error-response bodies so the request logger can
// surface the actual failure reason (the `{"error": "..."}` the handler wrote).
// Success and streaming responses are never buffered — capture is bounded both
// by a 4xx+ status gate and a byte cap so it can't balloon on large payloads.
type errorBodyWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

const maxLoggedErrorBody = 1024

func (w *errorBodyWriter) Write(b []byte) (int, error) {
	if w.Status() >= 400 && w.body.Len() < maxLoggedErrorBody {
		w.body.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

// recovery catches panics from coding errors and logs the panic value together
// with a full stack trace through zap (so the trace lands in the structured logs
// alongside the request line, not just on stderr), then returns a clean 500.
func recovery() gin.HandlerFunc {
	// We attach the stack explicitly below, so raise this logger's auto-stacktrace
	// threshold past Error to avoid logging the trace twice. io.Discard suppresses
	// gin's own (unstructured, stderr) dump so the only trace is the zap one.
	log := logger.Get().WithOptions(zap.AddStacktrace(zapcore.FatalLevel))
	return gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, recovered any) {
		log.Error("panic recovered",
			zap.Any("panic", recovered),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.ByteString("stack", debug.Stack()),
		)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	})
}

// requestLogger logs every request as a single structured line, with status-based
// level and the error reason on 4xx/5xx.
func requestLogger() gin.HandlerFunc {
	log := logger.Get()
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		bw := &errorBodyWriter{ResponseWriter: c.Writer}
		c.Writer = bw

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		fields := []zap.Field{
			zap.Int("status", status),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
		}
		if query != "" {
			fields = append(fields, zap.String("query", query))
		}
		// Prefer errors handlers registered explicitly; otherwise fall back to the
		// captured error-response body so the reason is always logged on a 4xx/5xx.
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("error", c.Errors.String()))
		} else if status >= 400 && bw.body.Len() > 0 {
			fields = append(fields, zap.String("error", strings.TrimSpace(bw.body.String())))
		}

		if status >= 500 {
			log.Error("request", fields...)
		} else if status >= 400 {
			log.Warn("request", fields...)
		} else {
			log.Info("request", fields...)
		}
	}
}
