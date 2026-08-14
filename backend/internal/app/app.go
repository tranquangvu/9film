// Package app is the composition root: it loads config, opens the database,
// builds the HTTP engine with global middleware, and lets each module wire and
// register itself. It exposes Run/Close for main.
package app

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/bentran/9film/backend/internal/clients/subdl"
	"github.com/bentran/9film/backend/internal/config"
	"github.com/bentran/9film/backend/internal/database"
	"github.com/bentran/9film/backend/internal/logger"
	"github.com/bentran/9film/backend/internal/middleware"
	"github.com/bentran/9film/backend/internal/modules/favorite"
	"github.com/bentran/9film/backend/internal/modules/history"
	"github.com/bentran/9film/backend/internal/modules/learning"
	"github.com/bentran/9film/backend/internal/modules/stream"
	"github.com/bentran/9film/backend/internal/modules/subtitle"
	"github.com/bentran/9film/backend/internal/modules/title"
	"github.com/bentran/9film/backend/internal/modules/user"
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

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatal("failed to open database", zap.Error(err))
	}

	// Every request runs as the one local account, resolved once here so the
	// modules keep taking a user id (see middleware.LocalUser).
	localUserID, err := user.LocalUserID(db)
	if err != nil {
		log.Fatal("failed to resolve the local account", zap.Error(err))
	}

	engine := gin.New()
	engine.Use(middleware.Logger(), middleware.Recovery(), middleware.CORS())
	registerRoutes(engine, db, localUserID)

	log.Info("starting 9film backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.String("db_path", cfg.DBPath),
	)

	return &App{Config: cfg, Router: engine, DB: db}
}

func registerRoutes(r *gin.Engine, db *sql.DB, localUserID int64) {
	api := r.Group("/api", middleware.LocalUser(localUserID))

	// API keys for the optional integrations, read from the database at request
	// time. Both are the user's own — the server carries no key of its own, so an
	// integration whose key isn't set is off rather than degraded.
	creds := user.NewCredentialStore(db)

	user.Module(api, db)
	favorite.Module(api, db)
	history.Module(api, db)
	title.Module(api, history.NewEnricher(db)) // folds per-user state into title responses
	learning.Module(api, db, geminiKeys{store: creds})
	stream.Module(r, api)
	// SubDL is the only subtitle provider wired in; clients/opensubtitles is kept
	// but never registered (see modules/subtitle/opensubtitles.go).
	subtitle.Module(api, subtitleCreds{store: creds}, subtitle.NewSubDL(subdl.New()))
}

// geminiKeys resolves the stored Gemini key for the learning module. An empty
// key leaves the AI features off; the module degrades on its own.
type geminiKeys struct {
	store *user.CredentialStore
}

func (g geminiKeys) Resolve(userID int64) (apiKey, model string) {
	return g.store.Get(userID).GeminiAPIKey, "" // stored key → generator's default model
}

// subtitleCreds resolves the stored credentials for one subtitle provider. It
// stays keyed by provider even though SubDL is the only one wired in — any other
// name resolves to empty creds, which is what an id from an unwired provider
// should get.
type subtitleCreds struct {
	store *user.CredentialStore
}

func (s subtitleCreds) For(provider string, userID int64) subtitle.Creds {
	if provider != subtitle.ProviderSubDL {
		return subtitle.Creds{}
	}
	return subtitle.Creds{APIKey: s.store.Get(userID).SubDLAPIKey}
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
