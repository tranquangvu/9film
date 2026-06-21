package title

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup, h *Handler, cfg *config.Config) {
	t := rg.Group("/title", middleware.AuthOptional(cfg))
	t.GET("/search", h.SearchTitles)
	t.GET("/trending", h.GetTrendingTitles)
	t.GET("/browse", h.BrowseTitles)
	t.GET("/:imdb/similar", h.GetSimilarTitles)
	t.GET("/:imdb", h.GetTitle)
}
