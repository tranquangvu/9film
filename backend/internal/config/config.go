package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type OpenSubtitlesConfig struct {
	APIKey   string
	Username string
	Password string
}

type Config struct {
	Port          int
	Host          string
	OpenSubtitles *OpenSubtitlesConfig

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

	return &Config{
		Port:          port,
		Host:          host,
		OpenSubtitles: openSubs,
		JWTSecret:     trim(os.Getenv("JWT_SECRET")),
		TokenTTL:      time.Duration(ttlHours) * time.Hour,
		DBPath:        dbPath,
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
