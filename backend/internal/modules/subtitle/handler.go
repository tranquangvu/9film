package subtitle

import (
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CredsResolver returns the OpenSubtitles credentials to use for a user — the
// user's own keys, or the .env fallback — composed at the root.
type CredsResolver interface {
	For(userID int64) Creds
}

type Handler struct {
	subs  Subtitles
	creds CredsResolver
}

func NewHandler(subs Subtitles, creds CredsResolver) *Handler {
	return &Handler{subs: subs, creds: creds}
}

func notConfigured(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"error": "OpenSubtitles is not configured. Add your API key in Connections.",
	})
}

func (h *Handler) SearchSubtitles(c *gin.Context) {
	creds := h.creds.For(middleware.UserID(c))
	if !creds.Configured() {
		notConfigured(c)
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

	subs, err := h.subs.SearchSubtitles(creds, params)
	if err != nil {
		logger.Get().Warn("subtitle search failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subtitles": subs})
}

func (h *Handler) GetSubtitleVTT(c *gin.Context) {
	creds := h.creds.For(middleware.UserID(c))
	if !creds.Configured() {
		notConfigured(c)
		return
	}

	fileIDRaw := c.Query("file_id")
	fileID, err := strconv.Atoi(fileIDRaw)
	if err != nil || fileID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid file_id required"})
		return
	}

	vtt, err := h.subs.DownloadSubtitleVTT(creds, fileID)
	if err != nil {
		logger.Get().Warn("subtitle VTT failed", zap.Int("file_id", fileID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Data(http.StatusOK, "text/vtt; charset=utf-8", []byte(vtt))
}
