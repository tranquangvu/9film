package subtitle

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(api *gin.RouterGroup, cfg *config.Config, creds CredsResolver) {
	h := NewHandler(NewSubtitles(), creds)
	RegisterRoutes(api, h, cfg)
}
