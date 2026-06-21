package favorite

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(rg *gin.RouterGroup, db *sql.DB, cfg *config.Config) {
	repo := NewRepository(db)
	svc := NewService(repo)
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
