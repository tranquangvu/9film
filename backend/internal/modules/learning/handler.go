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
	if h.svc.ImageEnabled(middleware.UserID(c)) {
		w.ImageStatus = "pending"
	}
	c.JSON(http.StatusCreated, w)
}

// GetWordImage streams a word's generated SVG; 404 when the word has no image.
func (h *Handler) GetWordImage(c *gin.Context) {
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
	if !h.svc.ImageEnabled(middleware.UserID(c)) {
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

// SubmitTest grades and stores a completed self-test, returning the full result.
func (h *Handler) SubmitTest(c *gin.Context) {
	var req submitTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no test items"})
		return
	}
	items := make([]TestSubmissionItem, 0, len(req.Items))
	for _, it := range req.Items {
		items = append(items, TestSubmissionItem{Word: it.Word, Spellings: it.Spellings, Meaning: it.Meaning})
	}
	result, err := h.svc.SubmitTest(middleware.UserID(c), req.List, req.GroupLabel, items)
	if err != nil {
		logger.Get().Warn("submit test failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not grade test"})
		return
	}
	c.JSON(http.StatusCreated, result)
}

// GetReviews returns the words currently due for spaced-repetition review.
func (h *Handler) GetReviews(c *gin.Context) {
	limit := 30
	if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := h.svc.GetDueReviews(middleware.UserID(c), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load reviews"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

// SubmitReview applies a recall grade to a due word and returns its updated schedule.
func (h *Handler) SubmitReview(c *gin.Context) {
	var req reviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	req.Word = strings.ToLower(strings.TrimSpace(req.Word))
	if req.Word == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
		return
	}
	switch req.Grade {
	case "again", "hard", "good", "easy":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "grade must be again|hard|good|easy"})
		return
	}
	w, err := h.svc.SubmitReview(middleware.UserID(c), req.Word, req.Grade)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "could not submit review"})
		return
	}
	c.JSON(http.StatusOK, w)
}

// GetTests returns the user's self-test history, newest first.
func (h *Handler) GetTests(c *gin.Context) {
	items, err := h.svc.GetTests(middleware.UserID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load test history"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
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
