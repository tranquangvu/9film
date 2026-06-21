package learning

import (
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(rg *gin.RouterGroup, h *Handler, cfg *config.Config) {
	l := rg.Group("/learn")
	l.GET("/define", h.Define)
	l.GET("/translate", h.Translate)

	me := rg.Group("/me", middleware.AuthRequired(cfg))
	me.GET("/words", h.GetWords)
	me.GET("/words/stats", h.GetWordStats)
	me.POST("/words", h.AddWord)
	me.DELETE("/words", h.RemoveWord)
	me.PUT("/words/complete", h.CompleteWord)
	me.GET("/words/image", h.GetWordImage)
	me.POST("/words/image", h.RegenerateWordImage)
}
