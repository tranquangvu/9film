package title

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

// Module wires the title feature (repository → service → handler) and registers
// its routes. enricher is injected (not built here) because title must not
// import the user package.
func Module(rg *gin.RouterGroup, cfg *config.Config, enricher Enricher) {
	repo := NewRepository()
	svc := NewService(repo)
	h := NewHandler(svc, enricher)
	RegisterRoutes(rg, h, cfg)
}
