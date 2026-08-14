package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port int
	Host string
	// DBPath is the SQLite file. It holds the single local account along with
	// everything keyed to it, including the API keys for the optional
	// integrations — the server itself carries no credentials.
	DBPath string
}

func Load() *Config {
	_ = godotenv.Load()

	port := 8081
	if p, err := strconv.Atoi(os.Getenv("PORT")); err == nil && p > 0 {
		port = p
	}

	// Loopback by default: the app is unauthenticated (see middleware.LocalUser),
	// so anything that can reach the port is the local user. Set HOST explicitly
	// to expose it on the network.
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	dbPath := trim(os.Getenv("DB_PATH"))
	if dbPath == "" {
		dbPath = "./9film.db"
	}

	return &Config{
		Port:   port,
		Host:   host,
		DBPath: dbPath,
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
