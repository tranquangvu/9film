package title

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the title routes on the given group (expected to carry
// AuthOptional so signed-in users get the isFavorite flag).
func (h *Handler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/search", h.SearchTitles)
	r.GET("/trending", h.GetTrendingTitles)
	r.GET("/browse", h.BrowseTitles)
	r.GET("/:imdb/similar", h.GetSimilarTitles)
	r.GET("/:imdb", h.GetTitle)
}
