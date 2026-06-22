package favorite

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/modules/title"
	"github.com/gin-gonic/gin"
)

func Module(rg *gin.RouterGroup, db *sql.DB, cfg *config.Config) {
	repo := NewRepository(db)
	// title.NoEnrichment: favorites are flagged IsFavorite by the service itself,
	// so the title service just supplies raw detail for hydration.
	svc := NewService(repo, title.NewService(title.NewRepository(), title.NoEnrichment))
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
