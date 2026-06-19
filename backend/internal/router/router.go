// Package router builds the HTTP engine: it applies the global middleware and
// registers every module's routes onto their (middleware-scoped) groups.
package router

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/learn"
	"github.com/bentran/nicefilm/backend/internal/media"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/bentran/nicefilm/backend/internal/user"
	"github.com/gin-gonic/gin"
)

// Handlers carries the per-module HTTP handlers the router wires up.
type Handlers struct {
	User  *user.Handler
	Title *title.Handler
	Media *media.Handler
	Learn *learn.Handler
}

// New builds the fully-wired *gin.Engine: global middleware plus each module's
// routes on their (middleware-scoped) groups.
func New(cfg *config.Config, h Handlers) *gin.Engine {
	r := gin.New()
	r.Use(middleware.Logger(), middleware.Recovery(), middleware.CORS())

	api := r.Group("/api")
	h.Title.RegisterRoutes(api.Group("/title", middleware.AuthOptional(cfg))) // signed-in → isFavorite
	h.Media.RegisterSubtitleRoutes(api.Group("/subtitle"))
	h.Media.RegisterStreamRoutes(api)
	h.Learn.RegisterRoutes(api.Group("/learn"))
	h.User.RegisterAuthRoutes(api.Group("/auth"))

	me := api.Group("/me", middleware.AuthRequired(cfg))
	h.User.RegisterRoutes(me)
	h.Learn.RegisterWordRoutes(me)

	h.Media.RegisterHLSRoutes(r)

	return r
}
