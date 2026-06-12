package config

import (
	"os"
	"strconv"

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
