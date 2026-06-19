package main

import (
	"github.com/bentran/nicefilm/backend/internal/bootstrap"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

func main() {
	app := bootstrap.NewApp()
	defer app.Close()

	if err := app.Run(); err != nil {
		logger.Get().Fatal("server failed", zap.Error(err))
	}
}
