package handler

import (
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SubtitleHandler proxies OpenSubtitles search/download via the Subtitles
// service (a no-op when OpenSubtitles isn't configured).
type SubtitleHandler struct {
	subs *service.Subtitles
}

func NewSubtitleHandler(subs *service.Subtitles) *SubtitleHandler {
	return &SubtitleHandler{subs: subs}
}

func (h *SubtitleHandler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/search", h.SearchSubtitles)
	r.GET("/download", h.GetSubtitleVTT)
}

func (h *SubtitleHandler) SearchSubtitles(c *gin.Context) {
	if !h.subs.Configured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "OpenSubtitles not configured. Set OPENSUBTITLES_API_KEY in .env",
		})
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

	params := service.SubtitleSearchParams{
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

	subs, err := h.subs.SearchSubtitles(params)
	if err != nil {
		logger.Get().Warn("subtitle search failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subtitles": subs})
}

func (h *SubtitleHandler) GetSubtitleVTT(c *gin.Context) {
	if !h.subs.Configured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "OpenSubtitles not configured. Set OPENSUBTITLES_API_KEY in .env",
		})
		return
	}

	fileIDRaw := c.Query("file_id")
	fileID, err := strconv.Atoi(fileIDRaw)
	if err != nil || fileID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid file_id required"})
		return
	}

	vtt, err := h.subs.DownloadSubtitleVTT(fileID)
	if err != nil {
		logger.Get().Warn("subtitle VTT failed", zap.Int("file_id", fileID), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Data(http.StatusOK, "text/vtt; charset=utf-8", []byte(vtt))
}
