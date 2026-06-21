package stream

import "github.com/gin-gonic/gin"

// Takes the engine too: /hls is mounted at the root, outside /api.
func RegisterRoutes(r *gin.Engine, api *gin.RouterGroup, h *Handler) {
	api.GET("/stream", h.GetStream)
	r.GET("/hls", h.ForwardHLS)
}
