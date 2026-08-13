package history

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	me := rg.Group("/me")
	me.GET("/history", h.GetHistory)
	me.PUT("/history", h.PutProgress)
	me.PUT("/subtitles", h.PutSubtitle)
}
