package subtitle

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(api *gin.RouterGroup, cfg *config.Config, creds CredsResolver) {
	// Every provider is registered; cfg.SubtitleProvider only picks the one that
	// searches. The rest stay reachable so ids saved under them still download.
	svc := NewSubtitles(cfg.SubtitleProvider, creds, NewSubDL(), NewOpenSubtitles())
	RegisterRoutes(api, NewHandler(svc), cfg)
}
