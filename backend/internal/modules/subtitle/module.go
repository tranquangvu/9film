package subtitle

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(api *gin.RouterGroup, cfg *config.Config, creds CredsResolver) {
	// SubDL is the only provider wired in. opensubtitles.go is kept but not
	// registered here — adding it back is a matter of appending NewOpenSubtitles()
	// and restoring its credentials (see the file's own note).
	svc := NewSubtitles(creds, NewSubDL())
	RegisterRoutes(api, NewHandler(svc), cfg)
}
