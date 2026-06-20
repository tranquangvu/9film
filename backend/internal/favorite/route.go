package favorite

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup, h *Handler, cfg *config.Config) {
	me := rg.Group("/me", middleware.AuthRequired(cfg))
	me.GET("/favorites", h.GetFavorites)
	me.POST("/favorites", h.AddFavorite)
	me.DELETE("/favorites", h.RemoveFavorite)
}
