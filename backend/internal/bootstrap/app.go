package bootstrap

import (
	"fmt"
	"os"
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
)

// App is the composition root: it holds the long-lived dependencies and the
// fully-wired HTTP engine. NewApp builds everything; Run starts serving.
type App struct {
	Config *config.Config
	Router *gin.Engine
	Store  *store.Store
}

// NewApp loads config, opens the store, wires every module (service → handler →
// routes), and returns a ready-to-serve App. Fatal on unrecoverable setup errors.
func NewApp() *App {
	cfg := config.Load()
	logger.Init(os.Getenv("GIN_MODE") != "release")
	log := logger.Get()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required (set it in backend/.env)")
	}

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatal("failed to open database", zap.Error(err))
	}

	router := gin.New()
	router.Use(requestLogger(), recovery(), cors.New(corsConfig()))

	// Services own the upstream integrations + their caches/credentials; a single
	// IMDb instance is shared so its title cache stays coherent across handlers.
	imdbSvc := service.NewIMDb()
	streamSvc := service.NewStream()
	hlsSvc := service.NewHLS()
	learnSvc := service.NewLearn()
	subsSvc := service.NewSubtitles(subtitleConfig(cfg))

	// Handlers (one per module).
	titleH := handler.NewTitleHandler(st, imdbSvc)
	subtitleH := handler.NewSubtitleHandler(subsSvc)
	streamH := handler.NewStreamHandler(streamSvc)
	learnH := handler.NewLearnHandler(learnSvc)
	authH := handler.NewAuthHandler(st, cfg)
	userH := handler.NewUserHandler(st, imdbSvc)
	hlsH := handler.NewHLSHandler(hlsSvc)

	// Routes — each module registers its own onto a (middleware-scoped) group.
	api := router.Group("/api")
	titleH.RegisterRoutes(api.Group("/title", middleware.AuthOptional(cfg))) // signed-in → isFavorite
	subtitleH.RegisterRoutes(api.Group("/subtitle"))
	streamH.RegisterRoutes(api)
	learnH.RegisterRoutes(api.Group("/learn"))
	authH.RegisterRoutes(api.Group("/auth"))
	userH.RegisterRoutes(api.Group("/me", middleware.AuthRequired(cfg)))
	hlsH.RegisterRoutes(router)

	log.Info("starting 9film backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.String("db_path", cfg.DBPath),
		zap.Bool("subtitles_configured", cfg.OpenSubtitles != nil),
	)

	return &App{Config: cfg, Router: router, Store: st}
}

// Run starts the HTTP server (blocks until it stops).
func (a *App) Run() error {
	return a.Router.Run(fmt.Sprintf("%s:%d", a.Config.Host, a.Config.Port))
}

// Close releases the App's resources. Safe to defer from main.
func (a *App) Close() {
	if a.Store != nil {
		a.Store.Close()
	}
	logger.Sync()
}

func corsConfig() cors.Config {
	return cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}
}

// subtitleConfig maps the app config's OpenSubtitles block into the service's
// config, or nil when OpenSubtitles isn't configured.
func subtitleConfig(cfg *config.Config) *service.SubtitleConfig {
	if cfg.OpenSubtitles == nil {
		return nil
	}
	return &service.SubtitleConfig{
		APIKey:   cfg.OpenSubtitles.APIKey,
		Username: cfg.OpenSubtitles.Username,
		Password: cfg.OpenSubtitles.Password,
	}
}
