package handler

import (
	"net/http"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// LearnHandler serves the language-learning helpers (dictionary + translation).
type LearnHandler struct {
	learn *service.Learn
}

func NewLearnHandler(learn *service.Learn) *LearnHandler {
	return &LearnHandler{learn: learn}
}

func (h *LearnHandler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/define", h.Define)
	r.GET("/translate", h.Translate)
}

// Define looks up an English word and its translation into the target language.
// GET /api/learn/define?word=...&target=vi
func (h *LearnHandler) Define(c *gin.Context) {
	word := strings.ToLower(strings.TrimSpace(c.Query("word")))
	if word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	target := c.Query("target")
	if target == "" {
		target = "vi"
	}

	def, err := h.learn.Define(word)
	if err != nil {
		logger.Get().Warn("define failed", zap.String("word", word), zap.Error(err))
	}
	translation, err := h.learn.Translate(word, target)
	if err != nil {
		logger.Get().Warn("translate word failed", zap.String("word", word), zap.Error(err))
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, gin.H{
		"word":        word,
		"definition":  def, // null when no dictionary entry
		"translation": translation,
	})
}

// Translate renders a phrase/sentence into the target language.
// GET /api/learn/translate?q=...&target=vi
func (h *LearnHandler) Translate(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}
	target := c.Query("target")
	if target == "" {
		target = "vi"
	}

	translation, err := h.learn.Translate(q, target)
	if err != nil {
		logger.Get().Warn("translate failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "translation unavailable"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, gin.H{"translation": translation})
}
