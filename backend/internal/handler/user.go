package handler

import (
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/bentran/nicefilm/backend/internal/service"
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

func GetFavorites(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.Favorites(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load favorites"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

type addFavoriteRequest struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
}

func AddFavorite(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req addFavoriteRequest
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
		if err := st.AddFavorite(middleware.UserID(c), req.ImdbID, req.MediaType); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add to favorites"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"imdbId": req.ImdbID, "mediaType": req.MediaType})
	}
}

func RemoveFavorite(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdbID := strings.TrimSpace(c.Query("imdbId"))
		if imdbID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId is required"})
			return
		}
		if err := st.RemoveFavorite(middleware.UserID(c), imdbID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove from favorites"})
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

// continueWatchingItem is a resume point with its IMDb title detail embedded, so
// the client can render the Continue Watching list without a per-title lookup.
type continueWatchingItem struct {
	store.Progress
	Title *service.ImdbTitle `json:"title,omitempty"`
}

// Bound concurrent IMDb lookups per request so a page doesn't fan out 50 calls.
const continueDetailConcurrency = 8

// GetContinueWatching returns the paginated, deduped-per-title resume list —
// with each title's detail embedded — that drives the Continue Watching list.
func GetContinueWatching(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
			limit = v
		}
		if limit > 50 {
			limit = 50
		}
		offset := 0
		if v, err := strconv.Atoi(c.Query("offset")); err == nil && v > 0 {
			offset = v
		}

		// Fetch one extra row to detect whether another page exists.
		rows, err := st.ContinueWatching(middleware.UserID(c), limit+1, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load continue watching"})
			return
		}
		hasMore := len(rows) > limit
		if hasMore {
			rows = rows[:limit]
		}

		// Hydrate each row's title detail concurrently (bounded).
		hydrated := make([]continueWatchingItem, len(rows))
		sem := make(chan struct{}, continueDetailConcurrency)
		var wg sync.WaitGroup
		for i := range rows {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				hydrated[i].Progress = rows[i]
				if t, err := service.GetTitle(rows[i].ImdbID); err == nil {
					hydrated[i].Title = t
				}
			}(i)
		}
		wg.Wait()

		// Drop rows whose title couldn't be resolved so the UI never shows blanks,
		// and flag the ones the user has favorited.
		fav, _ := st.FavoritedSet(middleware.UserID(c))
		items := make([]continueWatchingItem, 0, len(hydrated))
		for _, it := range hydrated {
			if it.Title == nil {
				continue
			}
			if _, ok := fav[it.Title.ID]; ok {
				it.Title.IsFavorite = true
			}
			items = append(items, it)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":      items,
			"hasMore":    hasMore,
			"nextOffset": offset + len(rows),
		})
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

func GetSubtitles(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.GetSubtitles(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load subtitle preferences"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func PutSubtitle(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var p store.Subtitle
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		p.ImdbID = strings.TrimSpace(p.ImdbID)
		if p.ImdbID == "" || p.FileID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "imdbId and a positive fileId are required"})
			return
		}
		if err := st.UpsertSubtitle(middleware.UserID(c), p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save subtitle preference"})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}

func GetWords(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
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
		rows, err := st.GetWords(middleware.UserID(c), c.Query("status"), limit+1, offset)
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
}

func GetWordStats(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := st.GetWordStats(middleware.UserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load word stats"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func AddWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var w store.Word
		if err := c.ShouldBindJSON(&w); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}
		w.Word = strings.ToLower(strings.TrimSpace(w.Word))
		if w.Word == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
			return
		}
		if err := st.AddWord(middleware.UserID(c), w); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save word"})
			return
		}
		c.JSON(http.StatusCreated, w)
	}
}

func RemoveWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		word := strings.ToLower(strings.TrimSpace(c.Query("word")))
		if word == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "word is required"})
			return
		}
		if err := st.RemoveWord(middleware.UserID(c), word); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove word"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

type completeWordRequest struct {
	Word string `json:"word"`
}

func CompleteWord(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
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
		if err := st.CompleteWord(middleware.UserID(c), req.Word); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete word"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
