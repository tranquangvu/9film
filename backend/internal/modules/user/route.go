package user

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup, h *Handler, cfg *config.Config) {
	auth := rg.Group("/auth")
	auth.POST("/signup", h.Signup)
	auth.POST("/login", h.Login)

	me := rg.Group("/me", middleware.AuthRequired(cfg))
	me.GET("", h.GetMe)
	me.PUT("", h.UpdateMe)
	me.GET("/settings", h.GetSettings)
	me.PUT("/settings", h.PutSettings)
	me.GET("/credentials", h.GetCredentials)
	me.PUT("/credentials", h.PutCredentials)
}
