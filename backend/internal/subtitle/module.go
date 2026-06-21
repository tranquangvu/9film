package subtitle

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(api *gin.RouterGroup, cfg *config.Config) {
	h := NewHandler(NewSubtitles(subtitleConfig(cfg)))
	RegisterRoutes(api, h)
}

func subtitleConfig(cfg *config.Config) *SubtitleConfig {
	if cfg.OpenSubtitles == nil {
		return nil
	}
	return &SubtitleConfig{
		APIKey:   cfg.OpenSubtitles.APIKey,
		Username: cfg.OpenSubtitles.Username,
		Password: cfg.OpenSubtitles.Password,
	}
}
