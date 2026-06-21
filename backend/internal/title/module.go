package title

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

// Module's enricher is injected (not built here) because title must not import
// the user package.
func Module(rg *gin.RouterGroup, cfg *config.Config, enricher Enricher) {
	repo := NewRepository()
	svc := NewService(repo, enricher)
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
