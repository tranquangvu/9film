package subtitle

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(api *gin.RouterGroup, h *Handler, cfg *config.Config) {
	// AuthOptional so a signed-in user's own OpenSubtitles keys are used; falls
	// back to the .env keys (the resolver handles userID 0).
	sub := api.Group("/subtitle", middleware.AuthOptional(cfg))
	sub.GET("/search", h.SearchSubtitles)
	sub.GET("/download", h.GetSubtitleVTT)
}
