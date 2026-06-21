package learning

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// Define looks up an English word and its translation into the target language.
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

	// Fetch one extra row to detect whether another page exists. The optional
	// `list` filter ('' = personal words, 'oxford3000' = the starter pack).
	rows, err := h.svc.GetWords(middleware.UserID(c), c.Query("status"), c.Query("list"), limit+1, offset)
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
	if h.svc.ImageEnabled() {
		w.ImageStatus = "pending"
	}
	c.JSON(http.StatusCreated, w)
}

// GetWordImage streams a word's generated PNG. 503 when illustrations are
// disabled, 404 when the word has no image yet.
func (h *Handler) GetWordImage(c *gin.Context) {
	if !h.svc.ImageEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "illustrations are not configured"})
		return
	}
	word := strings.ToLower(strings.TrimSpace(c.Query("word")))
	if word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	svg, ok := h.svc.WordImage(middleware.UserID(c), word)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "image not found"})
		return
	}
	// The image_updated_at (?v=) token makes the URL safe to cache hard.
	c.Header("Cache-Control", "private, max-age=31536000, immutable")
	c.Data(http.StatusOK, "image/svg+xml; charset=utf-8", svg)
}

// RegenerateWordImage (re)triggers generation for an existing word — backfills
// legacy words and retries failures.
func (h *Handler) RegenerateWordImage(c *gin.Context) {
	if !h.svc.ImageEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "illustrations are not configured"})
		return
	}
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
	if err := h.svc.RegenerateWordImage(middleware.UserID(c), req.Word); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "could not regenerate image"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"imageStatus": "pending"})
}

// ImportWords bulk-adds a bundled starter list (defaults to the Oxford 3000).
func (h *Handler) ImportWords(c *gin.Context) {
	var req importRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	list := strings.ToLower(strings.TrimSpace(req.List))
	if list == "" {
		list = "oxford3000"
	}
	added, err := h.svc.ImportWordList(middleware.UserID(c), list)
	if err != nil {
		logger.Get().Warn("word list import failed", zap.String("list", list), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not import word list"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"added": added})
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
