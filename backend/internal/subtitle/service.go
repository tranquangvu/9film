package subtitle

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const openSubsAPIBase = "https://api.opensubtitles.com/api/v1"
const openSubsUserAgent = "NiceFilm/1.0"

// SRT-parsing regexes, compiled once (they were previously recompiled per call
// and per cue block inside srtToVTT's loop — pure overhead on every download).
var (
	srtBlockSplitRe = regexp.MustCompile(`\n{2,}`)
	srtIndexLineRe  = regexp.MustCompile(`^\d+$`)
	srtTimeRe       = regexp.MustCompile(`^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})`)
)

type SubtitleConfig struct {
	APIKey   string
	Username string
	Password string
}

type tokenEntry struct {
	token     string
	expiresAt time.Time
}

// Subtitles proxies the OpenSubtitles API. The default implementation holds the
// configured credentials (nil when OpenSubtitles isn't configured) and caches
// the auth token.
type Subtitles interface {
	Configured() bool
	SearchSubtitles(params SubtitleSearchParams) ([]SubtitleOption, error)
	DownloadSubtitleVTT(fileID int) (string, error)
}

type subtitles struct {
	cfg     *SubtitleConfig
	client  *http.Client
	tokenMu sync.Mutex
	token   *tokenEntry
}

func NewSubtitles(cfg *SubtitleConfig) Subtitles {
	return &subtitles{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}}
}

func (s *subtitles) Configured() bool { return s.cfg != nil }

func baseSubsHeaders(apiKey string) map[string]string {
	return map[string]string{
		"Api-Key":    apiKey,
		"User-Agent": openSubsUserAgent,
		"Accept":     "application/json",
	}
}

func applyHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header.Set(k, v)
	}
}

func (s *subtitles) getAuthToken() (string, error) {
	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()

	if s.token != nil && time.Now().Before(s.token.expiresAt) {
		return s.token.token, nil
	}

	payload, _ := json.Marshal(map[string]string{
		"username": s.cfg.Username,
		"password": s.cfg.Password,
	})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/login", bytes.NewReader(payload))
	applyHeaders(req, baseSubsHeaders(s.cfg.APIKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenSubtitles login: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenSubtitles login failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Token == "" {
		return "", fmt.Errorf("OpenSubtitles: no token in login response")
	}

	s.token = &tokenEntry{
		token:     result.Token,
		expiresAt: time.Now().Add(23 * time.Hour),
	}
	return result.Token, nil
}

func imdbToNumeric(imdb string) int {
	numeric := strings.TrimPrefix(strings.ToLower(imdb), "tt")
	n, _ := strconv.Atoi(numeric)
	return n
}

func (s *subtitles) SearchSubtitles(params SubtitleSearchParams) ([]SubtitleOption, error) {
	if s.cfg == nil {
		return nil, nil
	}

	q := url.Values{}
	lang := params.Languages
	if lang == "" {
		lang = "en"
	}
	q.Set("languages", lang)
	q.Set("order_by", "new_download_count")
	q.Set("order_direction", "desc")

	if params.IMDbID != "" {
		numeric := imdbToNumeric(params.IMDbID)
		if params.MediaType == "tv" && params.Season != nil && params.Episode != nil {
			q.Set("parent_imdb_id", strconv.Itoa(numeric))
			q.Set("season_number", strconv.Itoa(*params.Season))
			q.Set("episode_number", strconv.Itoa(*params.Episode))
		} else {
			q.Set("imdb_id", strconv.Itoa(numeric))
		}
	} else if params.TMDbID > 0 {
		if params.MediaType == "tv" && params.Season != nil && params.Episode != nil {
			q.Set("parent_tmdb_id", strconv.Itoa(params.TMDbID))
			q.Set("season_number", strconv.Itoa(*params.Season))
			q.Set("episode_number", strconv.Itoa(*params.Episode))
		} else {
			q.Set("tmdb_id", strconv.Itoa(params.TMDbID))
		}
	} else {
		return nil, nil
	}

	req, _ := http.NewRequest(http.MethodGet, openSubsAPIBase+"/subtitles?"+q.Encode(), nil)
	applyHeaders(req, baseSubsHeaders(s.cfg.APIKey))

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OpenSubtitles search: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenSubtitles search failed (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data []struct {
			Attributes struct {
				Language         string `json:"language"`
				Release          string `json:"release"`
				DownloadCount    int    `json:"download_count"`
				NewDownloadCount int    `json:"new_download_count"`
				Files            []struct {
					FileID   int    `json:"file_id"`
					FileName string `json:"file_name"`
				} `json:"files"`
			} `json:"attributes"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode OpenSubtitles search: %w", err)
	}

	options := make([]SubtitleOption, 0, len(result.Data))
	for _, item := range result.Data {
		attr := item.Attributes
		if len(attr.Files) == 0 || attr.Files[0].FileID == 0 {
			continue
		}
		file := attr.Files[0]
		lang := attr.Language
		if lang == "" {
			lang = "und"
		}
		label := strings.ToUpper(lang)
		if attr.Release != "" {
			label = label + " — " + attr.Release
		}
		count := attr.NewDownloadCount
		if count == 0 {
			count = attr.DownloadCount
		}
		options = append(options, SubtitleOption{
			FileID:        file.FileID,
			Language:      lang,
			Label:         label,
			DownloadCount: count,
			Release:       attr.Release,
		})
	}

	return options, nil
}

func (s *subtitles) DownloadSubtitleVTT(fileID int) (string, error) {
	if s.cfg == nil {
		return "", fmt.Errorf("OpenSubtitles not configured")
	}
	if s.cfg.Username == "" || s.cfg.Password == "" {
		return "", fmt.Errorf("OpenSubtitles download requires OPENSUBTITLES_USERNAME and OPENSUBTITLES_PASSWORD")
	}

	token, err := s.getAuthToken()
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(map[string]int{"file_id": fileID})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/download", bytes.NewReader(payload))
	headers := baseSubsHeaders(s.cfg.APIKey)
	applyHeaders(req, headers)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenSubtitles download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenSubtitles download failed (%d): %s", resp.StatusCode, string(body))
	}

	var dlResult struct {
		Link string `json:"link"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dlResult); err != nil || dlResult.Link == "" {
		return "", fmt.Errorf("OpenSubtitles: no link in download response")
	}

	text, err := s.fetchSubtitleText(dlResult.Link)
	if err != nil {
		return "", err
	}

	lower := strings.ToLower(dlResult.Link)
	if strings.HasSuffix(lower, ".vtt") {
		if strings.HasPrefix(text, "WEBVTT") {
			return text, nil
		}
		return "WEBVTT\n\n" + text, nil
	}
	return srtToVTT(text), nil
}

func (s *subtitles) fetchSubtitleText(downloadURL string) (string, error) {
	req, _ := http.NewRequest(http.MethodGet, downloadURL, nil)
	req.Header.Set("User-Agent", openSubsUserAgent)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("subtitle file fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("subtitle file fetch failed (%d)", resp.StatusCode)
	}

	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read subtitle: %w", err)
	}

	if len(rawBytes) >= 2 && rawBytes[0] == 0x1f && rawBytes[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(rawBytes))
		if err != nil {
			return "", fmt.Errorf("gzip reader: %w", err)
		}
		defer gr.Close()
		decompressed, err := io.ReadAll(gr)
		if err != nil {
			return "", fmt.Errorf("gzip decompress: %w", err)
		}
		rawBytes = decompressed
	}

	return string(rawBytes), nil
}

func srtToVTT(srt string) string {
	normalized := strings.ReplaceAll(srt, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")

	if strings.TrimSpace(normalized) == "" {
		return "WEBVTT\n\n"
	}

	blocks := srtBlockSplitRe.Split(normalized, -1)
	var cues []string

	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}
		lines := strings.Split(block, "\n")
		if len(lines) < 2 {
			continue
		}

		timeIdx := 0
		if srtIndexLineRe.MatchString(strings.TrimSpace(lines[0])) {
			timeIdx = 1
		}

		if timeIdx >= len(lines) {
			continue
		}

		timeLine := strings.TrimSpace(lines[timeIdx])
		if !srtTimeRe.MatchString(timeLine) {
			continue
		}

		vttTimeLine := strings.ReplaceAll(timeLine, ",", ".")
		text := strings.TrimSpace(strings.Join(lines[timeIdx+1:], "\n"))
		if text == "" {
			continue
		}
		cues = append(cues, vttTimeLine+"\n"+text)
	}

	return "WEBVTT\n\n" + strings.Join(cues, "\n\n") + "\n"
}
