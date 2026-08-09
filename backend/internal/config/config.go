package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type OpenSubtitlesConfig struct {
	APIKey   string
	Username string
	Password string
}

type SubDLConfig struct {
	APIKey string
}

type Config struct {
	Port int
	Host string
	// SubtitleProvider is the source subtitle searches go to: "subdl" (default)
	// or "opensubtitles". Both stay compiled in either way, so a track saved under
	// the other one still downloads.
	SubtitleProvider string
	SubDL            *SubDLConfig
	OpenSubtitles    *OpenSubtitlesConfig

	JWTSecret string
	TokenTTL  time.Duration
	DBPath    string
}

func Load() *Config {
	_ = godotenv.Load()

	port := 8081
	if p, err := strconv.Atoi(os.Getenv("PORT")); err == nil && p > 0 {
		port = p
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}

	// Token lifetime — default 7 days (168h).
	ttlHours := 168
	if h, err := strconv.Atoi(os.Getenv("TOKEN_TTL_HOURS")); err == nil && h > 0 {
		ttlHours = h
	}

	dbPath := trim(os.Getenv("DB_PATH"))
	if dbPath == "" {
		dbPath = "./nicefilm.db"
	}

	var openSubs *OpenSubtitlesConfig
	if apiKey := trim(os.Getenv("OPENSUBTITLES_API_KEY")); apiKey != "" {
		openSubs = &OpenSubtitlesConfig{
			APIKey:   apiKey,
			Username: trim(os.Getenv("OPENSUBTITLES_USERNAME")),
			Password: trim(os.Getenv("OPENSUBTITLES_PASSWORD")),
		}
	}

	var subDL *SubDLConfig
	if apiKey := trim(os.Getenv("SUBDL_API_KEY")); apiKey != "" {
		subDL = &SubDLConfig{APIKey: apiKey}
	}

	// Anything but an explicit opt-out lands on SubDL, so a typo can't quietly
	// leave the server on the legacy provider.
	provider := strings.ToLower(trim(os.Getenv("SUBTITLE_PROVIDER")))
	if provider != "opensubtitles" {
		provider = "subdl"
	}

	return &Config{
		Port:             port,
		Host:             host,
		SubtitleProvider: provider,
		SubDL:            subDL,
		OpenSubtitles:    openSubs,
		JWTSecret:        trim(os.Getenv("JWT_SECRET")),
		TokenTTL:         time.Duration(ttlHours) * time.Hour,
		DBPath:           dbPath,
	}
}

func trim(s string) string {
	if len(s) < 2 {
		return s
	}
	if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
		return s[1 : len(s)-1]
	}
	return s
}
