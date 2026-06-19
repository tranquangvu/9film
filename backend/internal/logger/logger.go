package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var log *zap.Logger

func Init(isDev bool) {
	var cfg zap.Config
	if isDev {
		cfg = zap.NewDevelopmentConfig()
		cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		cfg = zap.NewProductionConfig()
	}
	// Development config attaches a full stacktrace to every Warn+; for an HTTP
	// access log that's pure noise (the frame is always this middleware). Only
	// trace genuine errors so routine 4xx warns stay to a concise one-liner.
	l, err := cfg.Build(zap.AddStacktrace(zapcore.ErrorLevel))
	if err != nil {
		panic(err)
	}
	log = l
}

func Get() *zap.Logger {
	if log == nil {
		Init(os.Getenv("GIN_MODE") != "release")
	}
	return log
}

func Sync() {
	if log != nil {
		_ = log.Sync()
	}
}
