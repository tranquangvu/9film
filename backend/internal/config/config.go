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

// GeminiConfig is present only when GEMINI_API_KEY is set; otherwise AI word
// illustrations are disabled and the learning module degrades gracefully.
type GeminiConfig struct {
	APIKey string
	Model  string
}

type Config struct {
	Port          int
	Host          string
	OpenSubtitles *OpenSubtitlesConfig
	Gemini        *GeminiConfig

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

	var gemini *GeminiConfig
	if apiKey := trim(os.Getenv("GEMINI_API_KEY")); apiKey != "" {
		// A text model: it writes SVG markup for the word illustration.
		model := trim(os.Getenv("GEMINI_MODEL"))
		if model == "" {
			model = "gemini-2.5-flash"
		}
		gemini = &GeminiConfig{APIKey: apiKey, Model: model}
	}

	return &Config{
		Port:          port,
		Host:          host,
		OpenSubtitles: openSubs,
		Gemini:        gemini,
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
