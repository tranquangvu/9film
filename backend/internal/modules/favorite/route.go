package favorite

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	me := rg.Group("/me")
	me.GET("/favorites", h.GetFavorites)
	me.POST("/favorites", h.AddFavorite)
	me.DELETE("/favorites", h.RemoveFavorite)
}
