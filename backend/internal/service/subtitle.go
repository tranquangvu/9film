package service

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

type SubtitleConfig struct {
	APIKey   string
	Username string
	Password string
}

type SubtitleOption struct {
	FileID        int    `json:"fileId"`
	Language      string `json:"language"`
	Label         string `json:"label"`
	DownloadCount int    `json:"downloadCount"`
	Release       string `json:"release"`
}

type SubtitleSearchParams struct {
	IMDbID    string
	TMDbID    int
	MediaType string
	Season    *int
	Episode   *int
	Languages string
}

type tokenEntry struct {
	token     string
	expiresAt time.Time
}

var (
	tokenMu    sync.Mutex
	cachedTok  *tokenEntry
)

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

func getAuthToken(apiKey, username, password string) (string, error) {
	tokenMu.Lock()
	defer tokenMu.Unlock()

	if cachedTok != nil && time.Now().Before(cachedTok.expiresAt) {
		return cachedTok.token, nil
	}

	payload, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/login", bytes.NewReader(payload))
	applyHeaders(req, baseSubsHeaders(apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
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

	cachedTok = &tokenEntry{
		token:     result.Token,
		expiresAt: time.Now().Add(23 * time.Hour),
	}
	return result.Token, nil
}

func imdbToNumeric(imdb string) int {
	re := regexp.MustCompile(`(?i)^tt`)
	numeric := re.ReplaceAllString(imdb, "")
	n, _ := strconv.Atoi(numeric)
	return n
}

func SearchSubtitles(cfg *SubtitleConfig, params SubtitleSearchParams) ([]SubtitleOption, error) {
	if cfg == nil {
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
	applyHeaders(req, baseSubsHeaders(cfg.APIKey))

	resp, err := http.DefaultClient.Do(req)
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
				Language        string  `json:"language"`
				Release         string  `json:"release"`
				DownloadCount   int     `json:"download_count"`
				NewDownloadCount int    `json:"new_download_count"`
				Files           []struct {
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

func DownloadSubtitleVTT(cfg *SubtitleConfig, fileID int) (string, error) {
	if cfg == nil {
		return "", fmt.Errorf("OpenSubtitles not configured")
	}
	if cfg.Username == "" || cfg.Password == "" {
		return "", fmt.Errorf("OpenSubtitles download requires OPENSUBTITLES_USERNAME and OPENSUBTITLES_PASSWORD")
	}

	token, err := getAuthToken(cfg.APIKey, cfg.Username, cfg.Password)
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(map[string]int{"file_id": fileID})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/download", bytes.NewReader(payload))
	headers := baseSubsHeaders(cfg.APIKey)
	applyHeaders(req, headers)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
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

	text, err := fetchSubtitleText(dlResult.Link)
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

func fetchSubtitleText(downloadURL string) (string, error) {
	req, _ := http.NewRequest(http.MethodGet, downloadURL, nil)
	req.Header.Set("User-Agent", openSubsUserAgent)

	resp, err := http.DefaultClient.Do(req)
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

	re := regexp.MustCompile(`\n{2,}`)
	blocks := re.Split(normalized, -1)
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
		if matched, _ := regexp.MatchString(`^\d+$`, strings.TrimSpace(lines[0])); matched {
			timeIdx = 1
		}

		if timeIdx >= len(lines) {
			continue
		}

		timeLine := strings.TrimSpace(lines[timeIdx])
		timeRe := regexp.MustCompile(`^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})`)
		if !timeRe.MatchString(timeLine) {
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
