package logger

import (
	"os"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	log      *zap.Logger
	initOnce sync.Once
)

// Init builds the global logger. Guarded by sync.Once so it's safe to call
// concurrently and idempotent — the first call wins, so main's explicit
// dev/release choice isn't clobbered by a later lazy Get().
func Init(isDev bool) {
	initOnce.Do(func() { build(isDev) })
}

func build(isDev bool) {
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
	// No-op once initialized (the common path); otherwise lazily build with the
	// env-derived mode so callers before Init() still get a usable logger.
	Init(os.Getenv("GIN_MODE") != "release")
	return log
}

func Sync() {
	if log != nil {
		_ = log.Sync()
	}
}
