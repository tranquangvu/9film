package main

import (
	"github.com/bentran/9film/backend/internal/app"
	"github.com/bentran/9film/backend/internal/logger"
	"go.uber.org/zap"
)

func main() {
	a := app.NewApp()
	defer a.Close()

	if err := a.Run(); err != nil {
		logger.Get().Fatal("server failed", zap.Error(err))
	}
}
