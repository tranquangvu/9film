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
	"github.com/bentran/nicefilm/backend/internal/favorite"
	"github.com/bentran/nicefilm/backend/internal/learning"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/stream"
	"github.com/bentran/nicefilm/backend/internal/subtitle"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/bentran/nicefilm/backend/internal/user"
	"github.com/bentran/nicefilm/backend/internal/watching"
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
	)

	return &App{Config: cfg, Router: engine, DB: db}
}

func registerRoutes(r *gin.Engine, db *sql.DB, cfg *config.Config) {
	api := r.Group("/api")

	user.Module(api, db, cfg)
	favorite.Module(api, db, cfg)
	watching.Module(api, db, cfg)
	title.Module(api, cfg, newTitleEnricher(db)) // enricher composed from favorite + watching
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
