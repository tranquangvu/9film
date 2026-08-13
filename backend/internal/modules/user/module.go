package user

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func Module(rg *gin.RouterGroup, db *sql.DB) {
	repo := NewRepository(db)
	svc := NewService(repo)
	h := NewHandler(svc)
	RegisterRoutes(rg, h)
}
