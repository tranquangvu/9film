package stream

import "github.com/gin-gonic/gin"

// Module takes the engine too because /hls is mounted at the root, outside /api.
func Module(r *gin.Engine, api *gin.RouterGroup) {
	h := NewHandler(NewStream(), NewHLS())
	RegisterRoutes(r, api, h)
}
