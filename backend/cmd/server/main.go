package main

import (
	"fmt"
	"os"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/router"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()

	isDev := os.Getenv("GIN_MODE") != "release"
	logger.Init(isDev)
	defer logger.Sync()

	log := logger.Get()
	log.Info("starting NiceFilm backend",
		zap.Int("port", cfg.Port),
		zap.String("host", cfg.Host),
		zap.Bool("subtitles_configured", cfg.OpenSubtitles != nil),
	)

	r := router.New(cfg)
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	if err := r.Run(addr); err != nil {
		log.Fatal("server failed", zap.Error(err))
	}
}
