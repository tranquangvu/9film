package history

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/favorite"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/gin-gonic/gin"
)

// Module owns the title service it uses to hydrate continue-watching, and reads
// the favorited set from the favorite module to flag those items.
func Module(rg *gin.RouterGroup, db *sql.DB, cfg *config.Config) {
	repo := NewRepository(db)
	// title.NoEnrichment: history wants raw title detail and does its own
	// favorite flagging in batch, so it skips per-title enrichment.
	svc := NewService(repo, title.NewService(title.NewRepository(), title.NoEnrichment), favorite.NewEnricher(db))
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
