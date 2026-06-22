package stream

import "github.com/gin-gonic/gin"

// Module takes the engine too because /hls is mounted at the root, outside /api.
func Module(r *gin.Engine, api *gin.RouterGroup) {
	// One shared resolver so stream resolution and the HLS proxy agree on (and
	// cache) the same discovered Referer.
	referer := newRefererResolver()
	h := NewHandler(NewStream(referer), NewHLS(referer))
	RegisterRoutes(r, api, h)
}
