package media

import "github.com/gin-gonic/gin"

// RegisterStreamRoutes mounts GET /stream on the given group (the /api group).
func (h *Handler) RegisterStreamRoutes(r gin.IRoutes) {
	r.GET("/stream", h.GetStream)
}

// RegisterSubtitleRoutes mounts the subtitle search/download routes on the given
// group (the /api/subtitle group).
func (h *Handler) RegisterSubtitleRoutes(r gin.IRoutes) {
	r.GET("/search", h.SearchSubtitles)
	r.GET("/download", h.GetSubtitleVTT)
}

// RegisterHLSRoutes mounts GET /proxy/hls (registered at the root, outside /api).
func (h *Handler) RegisterHLSRoutes(r gin.IRoutes) {
	r.GET("/proxy/hls", h.ForwardHLS)
}
