package subtitle

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// maxSubtitleIDLen bounds the opaque id: real ones are well under 100 bytes, and
// it goes straight into an upstream URL and the history table.
const maxSubtitleIDLen = 512

type Handler struct {
	subs Subtitles
}

func NewHandler(subs Subtitles) *Handler {
	return &Handler{subs: subs}
}

// notConfigured reports that the provider has no API key. The code is what the
// client branches on to offer adding one — subtitles are optional, so this is a
// prompt rather than a failure.
func (h *Handler) notConfigured(c *gin.Context, provider string) {
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error": fmt.Sprintf("%s is not configured. Add your API key in Connections.", providerLabel(provider)),
		"code":  "provider_key_missing",
	})
}

func (h *Handler) SearchSubtitles(c *gin.Context) {
	userID := middleware.UserID(c)
	if !h.subs.Configured(userID) {
		h.notConfigured(c, h.subs.ActiveName())
		return
	}

	mediaType := c.Query("type")
	if mediaType != "tv" && mediaType != "movie" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'tv' or 'movie'"})
		return
	}

	imdbID := c.Query("imdb_id")
	tmdbRaw := c.Query("tmdb_id")
	if imdbID == "" && tmdbRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imdb_id or tmdb_id required"})
		return
	}

	params := SubtitleSearchParams{
		IMDbID:    imdbID,
		MediaType: mediaType,
		Languages: c.Query("languages"),
	}

	if tmdbRaw != "" {
		n, _ := strconv.Atoi(tmdbRaw)
		params.TMDbID = n
	}

	if s := c.Query("season"); s != "" {
		n, _ := strconv.Atoi(s)
		params.Season = &n
	}
	if ep := c.Query("episode"); ep != "" {
		n, _ := strconv.Atoi(ep)
		params.Episode = &n
	}

	subs, err := h.subs.Search(userID, params)
	if err != nil {
		if errors.Is(err, ErrNotConfigured) {
			h.notConfigured(c, h.subs.ActiveName())
			return
		}
		logger.Get().Warn("subtitle search failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subtitles": subs})
}

func (h *Handler) GetSubtitleVTT(c *gin.Context) {
	id := strings.TrimSpace(c.Query("id"))
	if id == "" {
		// Deprecated alias: a browser still running the pre-provider bundle sends a
		// bare OpenSubtitles file id, which ParseID resolves.
		id = strings.TrimSpace(c.Query("file_id"))
	}
	if id == "" || len(id) > maxSubtitleIDLen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid id required"})
		return
	}

	vtt, err := h.subs.DownloadVTT(middleware.UserID(c), id)
	if err != nil {
		logger.Get().Warn("subtitle VTT failed", zap.String("id", id), zap.Error(err))
		switch {
		case errors.Is(err, ErrRateLimited):
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Your subtitle provider account hit its rate limit. Try again later.",
				"code":  "provider_rate_limited",
			})
		case errors.Is(err, ErrNotConfigured):
			// Name the id's own provider rather than the active one — they are the
			// same today, but the id is what the user is actually blocked on.
			provider, _, ok := ParseID(id)
			if !ok {
				provider = h.subs.ActiveName()
			}
			h.notConfigured(c, provider)
		case errors.Is(err, ErrUnknownProvider):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		}
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Data(http.StatusOK, "text/vtt; charset=utf-8", []byte(vtt))
}
