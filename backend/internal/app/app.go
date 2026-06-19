// Package app is the composition root: it loads config, opens the database,
// wires every module (repository → service → handler), builds the HTTP engine
// via the router, and exposes Run/Close for main.
package app

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/learn"
	"github.com/bentran/nicefilm/backend/internal/media"
	"github.com/bentran/nicefilm/backend/internal/router"
	"github.com/bentran/nicefilm/backend/internal/shared/database"
	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/bentran/nicefilm/backend/internal/user"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// App is the composition root: it holds the long-lived dependencies and the
// fully-wired HTTP engine. NewApp builds everything; Run starts serving.
type App struct {
	Config *config.Config
	Router *gin.Engine
	DB     *sql.DB
}

// titleEnricher adapts the user repository to title.Enricher so the title module
// can fold per-user favorite/progress/subtitle state into its responses without
// importing the user package (the dependency must point one way: user → title).
type titleEnricher struct {
	users *user.Repository
}

func (e titleEnricher) FavoritedSet(userID int64) map[string]struct{} {
	set, err := e.users.FavoritedSet(userID)
	if err != nil {
		logger.Get().Warn("favorited set lookup failed", zap.Error(err))
		return nil
	}
	return set
}

func (e titleEnricher) Progress(userID int64, imdbID string) []title.TitleProgress {
	rows, err := e.users.GetTitleProgress(userID, imdbID)
	if err != nil {
		return nil
	}
	out := make([]title.TitleProgress, len(rows))
	for i, r := range rows {
		out[i] = title.TitleProgress{
			Season:          r.Season,
			Episode:         r.Episode,
			PositionSeconds: r.PositionSeconds,
			DurationSeconds: r.DurationSeconds,
			UpdatedAt:       r.UpdatedAt,
		}
	}
	return out
}

func (e titleEnricher) SubtitlePref(userID int64, imdbID string) *title.TitleSubtitle {
	sub, err := e.users.GetTitleSubtitle(userID, imdbID)
	if err != nil || sub == nil {
		return nil
	}
	return &title.TitleSubtitle{FileID: sub.FileID, Language: sub.Language}
}

// NewApp loads config, opens the database, wires every module (repository →
// service → handler), builds the router, and returns a ready-to-serve App.
// Fatal on unrecoverable setup errors.
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

	// Repositories own data access (DB-backed or the upstream IMDb GraphQL).
	userRepo := user.NewRepository(db)
	learnRepo := learn.NewRepository(db)
	titleRepo := title.NewRepository()

	// Services own the business logic + upstream integrations. A single title
	// repository keeps its detail cache coherent across all callers.
	titleSvc := title.NewService(titleRepo)
	userSvc := user.NewService(userRepo, cfg, titleSvc)
	learnSvc := learn.NewService(learnRepo)
	streamSvc := media.NewStream()
	hlsSvc := media.NewHLS()
	subsSvc := media.NewSubtitles(subtitleConfig(cfg))

	// Handlers (one per module).
	titleH := title.NewHandler(titleSvc, titleEnricher{users: userRepo})
	userH := user.NewHandler(userSvc)
	learnH := learn.NewHandler(learnSvc)
	mediaH := media.NewHandler(streamSvc, hlsSvc, subsSvc)

	engine := router.New(cfg, router.Handlers{
		User:  userH,
		Title: titleH,
		Media: mediaH,
		Learn: learnH,
	})

	log.Info("starting 9film backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.String("db_path", cfg.DBPath),
		zap.Bool("subtitles_configured", cfg.OpenSubtitles != nil),
	)

	return &App{Config: cfg, Router: engine, DB: db}
}

// Run starts the HTTP server (blocks until it stops).
func (a *App) Run() error {
	return a.Router.Run(fmt.Sprintf("%s:%d", a.Config.Host, a.Config.Port))
}

// Close releases the App's resources. Safe to defer from main.
func (a *App) Close() {
	if a.DB != nil {
		a.DB.Close()
	}
	logger.Sync()
}

// subtitleConfig maps the app config's OpenSubtitles block into the media
// service's config, or nil when OpenSubtitles isn't configured.
func subtitleConfig(cfg *config.Config) *media.SubtitleConfig {
	if cfg.OpenSubtitles == nil {
		return nil
	}
	return &media.SubtitleConfig{
		APIKey:   cfg.OpenSubtitles.APIKey,
		Username: cfg.OpenSubtitles.Username,
		Password: cfg.OpenSubtitles.Password,
	}
}
