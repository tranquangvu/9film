package user

import "github.com/gin-gonic/gin"

// RegisterAuthRoutes mounts the auth routes (signup/login) on the given group.
func (h *Handler) RegisterAuthRoutes(r gin.IRoutes) {
	r.POST("/signup", h.Signup)
	r.POST("/login", h.Login)
}

// RegisterRoutes mounts the per-user routes on the given group (expected to
// carry AuthRequired).
func (h *Handler) RegisterRoutes(r gin.IRoutes) {
	r.GET("", h.GetMe)
	r.GET("/settings", h.GetSettings)
	r.PUT("/settings", h.PutSettings)
	r.GET("/favorites", h.GetFavorites)
	r.POST("/favorites", h.AddFavorite)
	r.DELETE("/favorites", h.RemoveFavorite)
	r.GET("/watching", h.GetWatching)
	r.PUT("/watching", h.PutProgress)
	r.PUT("/subtitles", h.PutSubtitle)
}
