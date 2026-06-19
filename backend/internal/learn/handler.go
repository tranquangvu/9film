package learn

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler serves the language-learning helpers (dictionary + translation) and
// the per-user saved-vocabulary endpoints.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Define looks up an English word and its translation into the target language.
// GET /api/learn/define?word=...&target=vi
func (h *Handler) Define(c *gin.Context) {
	word := strings.ToLower(strings.TrimSpace(c.Query("word")))
	if word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	target := c.Query("target")
	if target == "" {
		target = "vi"
	}

	def, err := h.svc.Define(word)
	if err != nil {
		logger.Get().Warn("define failed", zap.String("word", word), zap.Error(err))
	}
	translation, err := h.svc.Translate(word, target)
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
func (h *Handler) Translate(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}
	target := c.Query("target")
	if target == "" {
		target = "vi"
	}

	translation, err := h.svc.Translate(q, target)
	if err != nil {
		logger.Get().Warn("translate failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "translation unavailable"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.JSON(http.StatusOK, gin.H{"translation": translation})
}

func (h *Handler) GetWords(c *gin.Context) {
	limit := 30
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > 100 {
		limit = 100
	}
	offset := 0
	if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
		offset = v
	}

	// Fetch one extra row to detect whether another page exists.
	rows, err := h.svc.GetWords(middleware.UserID(c), c.Query("status"), limit+1, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load saved words"})
		return
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      rows,
		"hasMore":    hasMore,
		"nextOffset": offset + len(rows),
	})
}

func (h *Handler) GetWordStats(c *gin.Context) {
	items, err := h.svc.GetWordStats(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load word stats"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) AddWord(c *gin.Context) {
	var w Word
	if err := c.ShouldBindJSON(&w); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	w.Word = strings.ToLower(strings.TrimSpace(w.Word))
	if w.Word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	if err := h.svc.AddWord(middleware.UserID(c), w); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save word"})
		return
	}
	c.JSON(http.StatusCreated, w)
}

func (h *Handler) RemoveWord(c *gin.Context) {
	word := strings.ToLower(strings.TrimSpace(c.Query("word")))
	if word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	if err := h.svc.RemoveWord(middleware.UserID(c), word); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove word"})
		return
	}
	c.Status(http.StatusNoContent)
}

type completeWordRequest struct {
	Word string `json:"word"`
}

func (h *Handler) CompleteWord(c *gin.Context) {
	var req completeWordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	req.Word = strings.ToLower(strings.TrimSpace(req.Word))
	if req.Word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	if err := h.svc.CompleteWord(middleware.UserID(c), req.Word); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete word"})
		return
	}
	c.Status(http.StatusNoContent)
}
