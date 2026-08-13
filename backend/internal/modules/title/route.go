package title

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	t := rg.Group("/title")
	t.GET("/search", h.SearchTitles)
	t.GET("/trending", h.GetTrendingTitles)
	t.GET("/browse", h.BrowseTitles)
	t.GET("/:imdb/similar", h.GetSimilarTitles)
	t.GET("/:imdb", h.GetTitle)
}
