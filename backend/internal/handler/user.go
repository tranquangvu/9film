package handler

import (
	"net/http"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-gonic/gin"
)

// GetMe returns the authenticated user's profile.
func GetMe(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		u, err := st.GetUserByID(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

func GetSettings(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, err := st.GetSettings(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load settings"})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

func PutSettings(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var s store.Settings
		if err := c.ShouldBindJSON(&s); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		if s.DefaultSubtitleLang == "" {
			s.DefaultSubtitleLang = "en"
		}
		if s.DefaultQuality == "" {
			s.DefaultQuality = "auto"
		}
		if s.LearningLang == "" {
			s.LearningLang = "vi"
		}
		if err := st.UpsertSettings(middleware.UserID(c), s); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save settings"})
			return
		}
		c.JSON(http.StatusOK, s)
	}
}

func GetList(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.ListItems(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load list"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

type addListRequest struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
}

func AddList(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req addListRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		req.ImdbID = strings.TrimSpace(req.ImdbID)
		if req.ImdbID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId is required"})
			return
		}
		if req.MediaType != "series" {
			req.MediaType = "movie"
		}
		if err := st.AddListItem(middleware.UserID(c), req.ImdbID, req.MediaType); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to list"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"imdbId": req.ImdbID, "mediaType": req.MediaType})
	}
}

func RemoveList(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdbID := strings.TrimSpace(c.Query("imdbId"))
		if imdbID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId is required"})
			return
		}
		if err := st.RemoveListItem(middleware.UserID(c), imdbID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from list"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func GetProgress(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.GetProgress(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load progress"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func PutProgress(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p store.Progress
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		p.ImdbID = strings.TrimSpace(p.ImdbID)
		if p.ImdbID == "" || p.DurationSeconds <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId and a positive durationSeconds are required"})
			return
		}
		if err := st.UpsertProgress(middleware.UserID(c), p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save progress"})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

func GetSavedWords(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.GetSavedWords(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load saved words"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func AddSavedWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var w store.SavedWord
		if err := c.ShouldBindJSON(&w); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		w.Word = strings.ToLower(strings.TrimSpace(w.Word))
		if w.Word == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
			return
		}
		if err := st.AddSavedWord(middleware.UserID(c), w); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save word"})
			return
		}
		c.JSON(http.StatusCreated, w)
	}
}

func RemoveSavedWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		word := strings.ToLower(strings.TrimSpace(c.Query("word")))
		if word == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
			return
		}
		if err := st.RemoveSavedWord(middleware.UserID(c), word); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove word"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

type reviewWordRequest struct {
	Word         string `json:"word"`
	Box          int    `json:"box"`
	IntervalDays int    `json:"intervalDays"`
}

func ReviewWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req reviewWordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		req.Word = strings.ToLower(strings.TrimSpace(req.Word))
		if req.Word == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
			return
		}
		if req.IntervalDays < 0 {
			req.IntervalDays = 0
		}
		if err := st.ReviewWord(middleware.UserID(c), req.Word, req.Box, req.IntervalDays); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update review"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
