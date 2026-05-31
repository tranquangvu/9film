package router

import (
	"time"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/handler"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func New(cfg *config.Config) *gin.Engine {
	r := gin.New()

	r.Use(zapLogger())
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		title := api.Group("/title")
		{
			title.GET("/popular", handler.GetPopularTitles)
			title.GET("/trending", handler.GetTrendingTitles)
			title.GET("/search", handler.SearchTitles)
			title.GET("/browse", handler.BrowseTitles)
			title.GET("/:imdb/similar", handler.GetSimilarTitles)
			title.GET("/:imdb", handler.GetTitle)
		}

		subs := api.Group("/subtitle")
		{
			subs.GET("/search", handler.SearchSubtitles(cfg))
			subs.GET("/download", handler.GetSubtitleVTT(cfg))
		}

		api.GET("/stream", handler.GetStream())
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
