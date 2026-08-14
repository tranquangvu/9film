// Package server is the backend's public seam: everything real lives under
// internal/, which only this module may import, so an embedder in another module
// (the desktop build) goes through here.
//
// It exposes exactly what embedding needs — an http.Handler and a way to shut
// down — and nothing about how the app is wired.
package server

import (
	"net/http"

	"github.com/bentran/9film/backend/internal/app"
	"github.com/gin-gonic/gin"
)

type Server struct {
	app *app.App
}

// New builds the backend. Configuration still comes from the environment
// (DB_PATH, GIN_MODE); set it before calling.
func New() (*Server, error) {
	// Embedding means production. Setting GIN_MODE isn't enough — gin reads it
	// once at package init, which has already run by the time we get here.
	gin.SetMode(gin.ReleaseMode)

	a, err := app.New()
	if err != nil {
		return nil, err
	}
	return &Server{app: a}, nil
}

// Handler serves both /api/* and the root-mounted /hls proxy, so an embedder
// must route both to it.
func (s *Server) Handler() http.Handler { return s.app.Router }

// Close releases the database, letting SQLite checkpoint its WAL.
func (s *Server) Close() { s.app.Close() }
