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

	// Per-user API keys (with the .env keys as fallback) for the optional
	// integrations, resolved at request time.
	creds := user.NewCredentialStore(db)

	user.Module(api, db, cfg)
	favorite.Module(api, db, cfg)
	history.Module(api, db, cfg)
	title.Module(api, cfg, history.NewEnricher(db)) // folds per-user state into title responses
	learning.Module(api, db, cfg, geminiKeys{store: creds, cfg: cfg.Gemini})
	stream.Module(r, api)
	subtitle.Module(api, cfg, openSubtitlesCreds{store: creds, cfg: cfg.OpenSubtitles})
}

// geminiKeys resolves a user's Gemini key (then the .env key) for the learning module.
type geminiKeys struct {
	store *user.CredentialStore
	cfg   *config.GeminiConfig
}

func (g geminiKeys) Resolve(userID int64) (apiKey, model string) {
	if key := g.store.Get(userID).GeminiAPIKey; key != "" {
		return key, "" // user key → generator's default model
	}
	if g.cfg != nil {
		return g.cfg.APIKey, g.cfg.Model
	}
	return "", ""
}

// openSubtitlesCreds resolves a user's OpenSubtitles credentials (then .env).
type openSubtitlesCreds struct {
	store *user.CredentialStore
	cfg   *config.OpenSubtitlesConfig
}

func (o openSubtitlesCreds) For(userID int64) subtitle.Creds {
	if c := o.store.Get(userID); c.OpenSubtitlesAPIKey != "" {
		return subtitle.Creds{APIKey: c.OpenSubtitlesAPIKey, Username: c.OpenSubtitlesUsername, Password: c.OpenSubtitlesPassword}
	}
	if o.cfg != nil {
		return subtitle.Creds{APIKey: o.cfg.APIKey, Username: o.cfg.Username, Password: o.cfg.Password}
	}
	return subtitle.Creds{}
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
