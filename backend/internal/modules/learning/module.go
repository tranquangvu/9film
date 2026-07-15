package learning

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/gin-gonic/gin"
)

func Module(rg *gin.RouterGroup, db *sql.DB, cfg *config.Config, keys GeminiKeys) {
	repo := NewRepository(db)
	svc := NewService(repo, NewGenerator(), keys)
	h := NewHandler(svc)
	RegisterRoutes(rg, h, cfg)
}
