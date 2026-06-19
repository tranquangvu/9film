package router

import (
	"bytes"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/handler"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-contrib/cors"
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

func New(cfg *config.Config, st *store.Store) *gin.Engine {
	r := gin.New()

	r.Use(zapLogger())
	r.Use(recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		// Public, but AuthOptional lets signed-in users get the `isFavorite` flag.
		title := api.Group("/title", middleware.AuthOptional(cfg))
		{
			title.GET("/search", handler.SearchTitles(st))
			title.GET("/trending", handler.GetTrendingTitles(st))
			title.GET("/browse", handler.BrowseTitles(st))
			title.GET("/:imdb/similar", handler.GetSimilarTitles(st))
			title.GET("/:imdb", handler.GetTitle(st))
		}

		subs := api.Group("/subtitle")
		{
			subs.GET("/search", handler.SearchSubtitles(cfg))
			subs.GET("/download", handler.GetSubtitleVTT(cfg))
		}

		api.GET("/stream", handler.GetStream())

		// Language-learning helpers (public)
		learn := api.Group("/learn")
		{
			learn.GET("/define", handler.Define())
			learn.GET("/translate", handler.Translate())
		}

		// Auth (public)
		authGrp := api.Group("/auth")
		{
			authGrp.POST("/signup", handler.Signup(st, cfg))
			authGrp.POST("/login", handler.Login(st, cfg))
		}

		// Per-user data (protected)
		me := api.Group("/me", middleware.AuthRequired(cfg))
		{
			me.GET("", handler.GetMe(st))
			me.GET("/settings", handler.GetSettings(st))
			me.PUT("/settings", handler.PutSettings(st))
			me.GET("/favorites", handler.GetFavorites(st))
			me.POST("/favorites", handler.AddFavorite(st))
			me.DELETE("/favorites", handler.RemoveFavorite(st))
			me.GET("/progress", handler.GetProgress(st))
			me.GET("/continue-watching", handler.GetContinueWatching(st))
			me.PUT("/progress", handler.PutProgress(st))
			me.GET("/subtitles", handler.GetSubtitles(st))
			me.PUT("/subtitles", handler.PutSubtitle(st))
			me.GET("/words", handler.GetWords(st))
			me.GET("/words/stats", handler.GetWordStats(st))
			me.POST("/words", handler.AddWord(st))
			me.DELETE("/words", handler.RemoveWord(st))
			me.PUT("/words/complete", handler.CompleteWord(st))
		}
	}

	r.GET("/proxy/hls", handler.ForwardHLS())

	return r
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

func zapLogger() gin.HandlerFunc {
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
