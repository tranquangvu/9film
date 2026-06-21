package subtitle

import "github.com/gin-gonic/gin"

func RegisterRoutes(api *gin.RouterGroup, h *Handler) {
	sub := api.Group("/subtitle")
	sub.GET("/search", h.SearchSubtitles)
	sub.GET("/download", h.GetSubtitleVTT)
}
