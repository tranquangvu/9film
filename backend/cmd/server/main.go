package main

import (
	"fmt"
	"os"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/router"
	"github.com/bentran/nicefilm/backend/internal/store"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()

	isDev := os.Getenv("GIN_MODE") != "release"
	logger.Init(isDev)
	defer logger.Sync()

	log := logger.Get()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required (set it in backend/.env)")
	}

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatal("failed to open database", zap.Error(err))
	}
	defer st.Close()

	log.Info("starting NiceFilm backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.String("db_path", cfg.DBPath),
		zap.Bool("subtitles_configured", cfg.OpenSubtitles != nil),
	)

	r := router.New(cfg, st)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	if err := r.Run(addr); err != nil {
		log.Fatal("server failed", zap.Error(err))
	}
}
