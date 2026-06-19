package learn

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the public learn routes (define/translate) on the given
// group (the /api/learn group).
func (h *Handler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/define", h.Define)
	r.GET("/translate", h.Translate)
}

// RegisterWordRoutes mounts the per-user vocabulary routes on the given group
// (expected to carry AuthRequired — the /api/me group).
func (h *Handler) RegisterWordRoutes(r gin.IRoutes) {
	r.GET("/words", h.GetWords)
	r.GET("/words/stats", h.GetWordStats)
	r.POST("/words", h.AddWord)
	r.DELETE("/words", h.RemoveWord)
	r.PUT("/words/complete", h.CompleteWord)
}
