package media

import (
	"net/http"
	"strconv"

	"github.com/bentran/nicefilm/backend/internal/shared/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler proxies the media-delivery endpoints: stream resolution, HLS manifest/
// segment proxying, and OpenSubtitles search/download.
type Handler struct {
	stream *Stream
	hls    *HLS
	subs   *Subtitles
}

func NewHandler(stream *Stream, hls *HLS, subs *Subtitles) *Handler {
	return &Handler{stream: stream, hls: hls, subs: subs}
}

// RegisterStreamRoutes mounts GET /stream on the given group (the /api group).
func (h *Handler) RegisterStreamRoutes(r gin.IRoutes) {
	r.GET("/stream", h.GetStream)
}

// RegisterSubtitleRoutes mounts the subtitle search/download routes on the given
// group (the /api/subtitle group).
func (h *Handler) RegisterSubtitleRoutes(r gin.IRoutes) {
	r.GET("/search", h.SearchSubtitles)
	r.GET("/download", h.GetSubtitleVTT)
}

// RegisterHLSRoutes mounts GET /proxy/hls (registered at the root, outside /api).
func (h *Handler) RegisterHLSRoutes(r gin.IRoutes) {
	r.GET("/proxy/hls", h.ForwardHLS)
}

func (h *Handler) GetStream(c *gin.Context) {
	result, err := h.stream.ProxyStreamRequest(c.Request.URL.RawQuery)
	if err != nil {
		logger.Get().Error("stream proxy failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}

func (h *Handler) ForwardHLS(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url query param required"})
		return
	}

	result, err := h.hls.ProxyHLS(targetURL)
	if err != nil {
		logger.Get().Error("HLS proxy failed", zap.String("url", targetURL), zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Data(result.Status, result.ContentType, result.Body)
}

func (h *Handler) SearchSubtitles(c *gin.Context) {
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

	subs, err := h.subs.SearchSubtitles(params)
	if err != nil {
		logger.Get().Warn("subtitle search failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"subtitles": subs})
}

func (h *Handler) GetSubtitleVTT(c *gin.Context) {
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
