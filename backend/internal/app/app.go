// Package app is the composition root: it loads config, opens the database,
// builds the HTTP engine with global middleware, and lets each module wire and
// register itself. It exposes Run/Close for main.
package app

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/database"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/modules/favorite"
	"github.com/bentran/nicefilm/backend/internal/modules/history"
	"github.com/bentran/nicefilm/backend/internal/modules/learning"
	"github.com/bentran/nicefilm/backend/internal/modules/stream"
	"github.com/bentran/nicefilm/backend/internal/modules/subtitle"
	"github.com/bentran/nicefilm/backend/internal/modules/title"
	"github.com/bentran/nicefilm/backend/internal/modules/user"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type App struct {
	Config *config.Config
	Router *gin.Engine
	DB     *sql.DB
}

func NewApp() *App {
	cfg := config.Load()
	logger.Init(os.Getenv("GIN_MODE") != "release")
	log := logger.Get()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required (set it in backend/.env)")
	}

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatal("failed to open database", zap.Error(err))
	}

	engine := gin.New()
	engine.Use(middleware.Logger(), middleware.Recovery(), middleware.CORS())
	registerRoutes(engine, db, cfg)

	log.Info("starting 9film backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.String("db_path", cfg.DBPath),
		zap.Bool("subtitles_configured", cfg.OpenSubtitles != nil),
		zap.Bool("gemini_configured", cfg.Gemini != nil),
	)

	return &App{Config: cfg, Router: engine, DB: db}
}

func registerRoutes(r *gin.Engine, db *sql.DB, cfg *config.Config) {
	api := r.Group("/api")

	user.Module(api, db, cfg)
	favorite.Module(api, db, cfg)
	history.Module(api, db, cfg)
	title.Module(api, cfg, history.NewEnricher(db)) // folds per-user state into title responses
	learning.Module(api, db, cfg)
	stream.Module(r, api)
	subtitle.Module(api, cfg)
}

func (a *App) Run() error {
	return a.Router.Run(fmt.Sprintf("%s:%d", a.Config.Host, a.Config.Port))
}

func (a *App) Close() {
	if a.DB != nil {
		a.DB.Close()
	}
	logger.Sync()
}
