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
	l, err := cfg.Build()
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
