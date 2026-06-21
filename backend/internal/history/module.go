package history

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/favorite"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/gin-gonic/gin"
)

// Module wires the history feature (repository → service → handler) and
// registers its routes. It owns the title service it uses to hydrate
// continue-watching, and reads the favorited set from the favorite module to
// flag those items.
func Module(rg *gin.RouterGroup, db *sql.DB, cfg *config.Config) {
	repo := NewRepository(db)
	svc := NewService(repo, title.NewService(title.NewRepository()), favorite.NewEnricher(db))
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
