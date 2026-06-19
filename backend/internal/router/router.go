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
	"github.com/bentran/nicefilm/backend/internal/service"
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

	// Services own the upstream integrations + their caches/credentials; a single
	// IMDb instance is shared so its title cache stays coherent across handlers.
	imdbSvc := service.NewIMDb()
	streamSvc := service.NewStream()
	hlsSvc := service.NewHLS()
	learnSvc := service.NewLearn()

	var subCfg *service.SubtitleConfig
	if cfg.OpenSubtitles != nil {
		subCfg = &service.SubtitleConfig{
			APIKey:   cfg.OpenSubtitles.APIKey,
			Username: cfg.OpenSubtitles.Username,
			Password: cfg.OpenSubtitles.Password,
		}
	}
	subsSvc := service.NewSubtitles(subCfg)

	titleH := handler.NewTitleHandler(st, imdbSvc)
	subtitleH := handler.NewSubtitleHandler(subsSvc)
	streamH := handler.NewStreamHandler(streamSvc)
	learnH := handler.NewLearnHandler(learnSvc)
	authH := handler.NewAuthHandler(st, cfg)
	userH := handler.NewUserHandler(st, imdbSvc)
	hlsH := handler.NewHLSHandler(hlsSvc)

	api := r.Group("/api")
	{
		// Public, but AuthOptional lets signed-in users get the `isFavorite` flag.
		title := api.Group("/title", middleware.AuthOptional(cfg))
		{
			title.GET("/search", titleH.SearchTitles)
			title.GET("/trending", titleH.GetTrendingTitles)
			title.GET("/browse", titleH.BrowseTitles)
			title.GET("/:imdb/similar", titleH.GetSimilarTitles)
			title.GET("/:imdb", titleH.GetTitle)
		}

		subs := api.Group("/subtitle")
		{
			subs.GET("/search", subtitleH.SearchSubtitles)
			subs.GET("/download", subtitleH.GetSubtitleVTT)
		}

		api.GET("/stream", streamH.GetStream)

		// Language-learning helpers (public)
		learn := api.Group("/learn")
		{
			learn.GET("/define", learnH.Define)
			learn.GET("/translate", learnH.Translate)
		}

		// Auth (public)
		authGrp := api.Group("/auth")
		{
			authGrp.POST("/signup", authH.Signup)
			authGrp.POST("/login", authH.Login)
		}

		// Per-user data (protected)
		me := api.Group("/me", middleware.AuthRequired(cfg))
		{
			me.GET("", userH.GetMe)
			me.GET("/settings", userH.GetSettings)
			me.PUT("/settings", userH.PutSettings)
			me.GET("/favorites", userH.GetFavorites)
			me.POST("/favorites", userH.AddFavorite)
			me.DELETE("/favorites", userH.RemoveFavorite)
			me.GET("/watching", userH.GetWatching)
			me.PUT("/watching", userH.PutProgress)
			me.PUT("/subtitles", userH.PutSubtitle)
			me.GET("/words", userH.GetWords)
			me.GET("/words/stats", userH.GetWordStats)
			me.POST("/words", userH.AddWord)
			me.DELETE("/words", userH.RemoveWord)
			me.PUT("/words/complete", userH.CompleteWord)
		}
	}

	r.GET("/proxy/hls", hlsH.ForwardHLS)

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
