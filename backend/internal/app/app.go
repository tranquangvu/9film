// Package app is the composition root: it loads config, opens the database,
// builds the HTTP engine with global middleware, and lets each module wire and
// register itself. It exposes Run/Close for main.
package app

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/bentran/nicefilm/backend/internal/clients/subdl"
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
		zap.Bool("subtitles_configured", cfg.SubDL != nil),
	)

	return &App{Config: cfg, Router: engine, DB: db}
}

func registerRoutes(r *gin.Engine, db *sql.DB, cfg *config.Config) {
	api := r.Group("/api")

	// Per-user API keys for the optional integrations, resolved at request time.
	// Gemini is per-user only; the subtitle providers fall back to the .env keys.
	creds := user.NewCredentialStore(db)

	user.Module(api, db, cfg)
	favorite.Module(api, db, cfg)
	history.Module(api, db, cfg)
	title.Module(api, cfg, history.NewEnricher(db)) // folds per-user state into title responses
	learning.Module(api, db, cfg, geminiKeys{store: creds})
	stream.Module(r, api)
	// SubDL is the only subtitle provider wired in; clients/opensubtitles is kept
	// but never registered (see modules/subtitle/opensubtitles.go).
	subtitle.Module(api, cfg, subtitleCreds{store: creds, cfg: cfg}, subtitle.NewSubDL(subdl.New()))
}

// geminiKeys resolves a user's Gemini key for the learning module. There is no
// .env fallback — AI features require the user to supply their own key.
type geminiKeys struct {
	store *user.CredentialStore
}

func (g geminiKeys) Resolve(userID int64) (apiKey, model string) {
	return g.store.Get(userID).GeminiAPIKey, "" // user key → generator's default model
}

// subtitleCreds resolves a user's credentials for one subtitle provider: their
// own stored key first, then the .env fallback (flagged Shared so the handler
// can nudge them to add their own when the shared account gets throttled). It
// stays keyed by provider even though SubDL is the only one wired in — any other
// name resolves to empty creds, which is what an id from an unwired provider
// should get.
type subtitleCreds struct {
	store *user.CredentialStore
	cfg   *config.Config
}

func (s subtitleCreds) For(provider string, userID int64) subtitle.Creds {
	if provider != subtitle.ProviderSubDL {
		return subtitle.Creds{}
	}
	if key := s.store.Get(userID).SubDLAPIKey; key != "" {
		return subtitle.Creds{APIKey: key}
	}
	if s.cfg.SubDL != nil {
		return subtitle.Creds{APIKey: s.cfg.SubDL.APIKey, Shared: true}
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
