package router

import (
	"time"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/handler"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func New(cfg *config.Config, st *store.Store) *gin.Engine {
	r := gin.New()

	r.Use(zapLogger())
	r.Use(gin.Recovery())
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
			me.POST("/words", handler.AddWord(st))
			me.DELETE("/words", handler.RemoveWord(st))
			me.PUT("/words/complete", handler.CompleteWord(st))
		}
	}

	r.GET("/proxy/hls", handler.ForwardHLS())

	return r
}

func zapLogger() gin.HandlerFunc {
	log := logger.Get()
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

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
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("error", c.Errors.String()))
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
