package media

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

// embedReferer is the Referer the upstream CDNs require. Injecting it server-side
// is the whole reason these endpoints proxy instead of the browser calling direct.
const embedReferer = "https://nextgencloudfabric.com/"

const streamAPIURL = "https://streamdata.vaplayer.ru/api.php"

const openSubsAPIBase = "https://api.opensubtitles.com/api/v1"
const openSubsUserAgent = "NiceFilm/1.0"

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

type StreamResult struct {
	Body        []byte
	Status      int
	ContentType string
}

// Stream proxies the upstream stream-resolution API.
type Stream struct {
	client *http.Client
}

func NewStream() *Stream {
	return &Stream{client: http.DefaultClient}
}

func (s *Stream) ProxyStreamRequest(rawQuery string) (*StreamResult, error) {
	target, err := url.Parse(streamAPIURL)
	if err != nil {
		return nil, err
	}

	incoming, err := url.ParseQuery(rawQuery)
	if err != nil {
		return nil, fmt.Errorf("invalid query string: %w", err)
	}
	target.RawQuery = incoming.Encode()

	req, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", embedReferer)
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stream API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read stream response: %w", err)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/json"
	}

	// The upstream PHP endpoint occasionally prepends HTML warnings/notices
	// (e.g. "<br /> <b>Warning</b>: ... on line <b>123</b>") before the JSON
	// payload, which makes the browser's JSON.parse choke on a leading '<'.
	// Recover the JSON object so callers always receive parseable data.
	if cleaned, ok := extractJSON(body); ok {
		body = cleaned
		ct = "application/json"
	}

	return &StreamResult{
		Body:        body,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}

// extractJSON pulls the outermost JSON object out of a response body that may be
// polluted with leading or trailing non-JSON content (such as PHP warnings). It
// returns the cleaned slice and whether any cleaning was applied.
func extractJSON(body []byte) ([]byte, bool) {
	if len(bytes.TrimSpace(body)) == 0 {
		return body, false
	}
	// Already clean JSON — leave it untouched.
	if b := bytes.TrimSpace(body); b[0] == '{' || b[0] == '[' {
		return body, false
	}
	start := bytes.IndexByte(body, '{')
	end := bytes.LastIndexByte(body, '}')
	if start < 0 || end <= start {
		return body, false
	}
	return body[start : end+1], true
}

// ---------------------------------------------------------------------------
// HLS
// ---------------------------------------------------------------------------

type HLSResult struct {
	Body        []byte
	Status      int
	ContentType string
}

func toAbsoluteURL(baseRaw, ref string) string {
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref
	}
	base, err := url.Parse(baseRaw)
	if err != nil {
		return ref
	}
	if strings.HasPrefix(ref, "/") {
		return fmt.Sprintf("%s://%s%s", base.Scheme, base.Host, ref)
	}
	resolved, err := base.Parse(ref)
	if err != nil {
		return ref
	}
	return resolved.String()
}

func toProxyPath(absoluteURL string) string {
	return "/proxy/hls?url=" + url.QueryEscape(absoluteURL)
}

func rewriteM3U8(body, sourceURL string) string {
	lines := strings.Split(body, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "#") {
			lines[i] = rewriteURIAttributes(line, sourceURL)
		} else {
			lines[i] = toProxyPath(toAbsoluteURL(sourceURL, trimmed))
		}
	}
	return strings.Join(lines, "\n")
}

func rewriteURIAttributes(line, sourceURL string) string {
	const prefix = `URI="`
	for {
		start := strings.Index(line, prefix)
		if start == -1 {
			break
		}
		uriStart := start + len(prefix)
		end := strings.Index(line[uriStart:], `"`)
		if end == -1 {
			break
		}
		uri := line[uriStart : uriStart+end]
		absolute := toAbsoluteURL(sourceURL, uri)
		proxy := toProxyPath(absolute)
		line = line[:uriStart] + proxy + line[uriStart+end:]
	}
	return line
}

// HLS proxies HLS manifests and segments, rewriting manifest URIs back through
// the local /proxy/hls route so the CDN only ever sees the server's Referer.
type HLS struct {
	client *http.Client
}

func NewHLS() *HLS {
	return &HLS{client: http.DefaultClient}
}

func (s *HLS) ProxyHLS(targetURL string) (*HLSResult, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", embedReferer)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HLS upstream failed: %w", err)
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read HLS body: %w", err)
	}

	isM3U8 := strings.Contains(targetURL, ".m3u8") ||
		strings.Contains(ct, "mpegurl") ||
		strings.Contains(ct, "m3u8")

	isTSSegment := !isM3U8 && (strings.Contains(targetURL, ".ts") ||
		strings.Contains(ct, "mp2t"))

	var finalBody []byte
	if resp.StatusCode == http.StatusOK && isM3U8 {
		rewritten := rewriteM3U8(string(body), targetURL)
		finalBody = []byte(rewritten)
	} else {
		finalBody = body
	}

	if isM3U8 {
		ct = "application/vnd.apple.mpegurl"
	} else if isTSSegment {
		ct = "video/mp2t"
	} else if ct == "" {
		ct = "application/octet-stream"
	}

	return &HLSResult{
		Body:        finalBody,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}

// ---------------------------------------------------------------------------
// Subtitles (OpenSubtitles)
// ---------------------------------------------------------------------------

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

// Subtitles proxies the OpenSubtitles API. It holds the configured credentials
// (nil when OpenSubtitles isn't configured) and caches the auth token.
type Subtitles struct {
	cfg     *SubtitleConfig
	client  *http.Client
	tokenMu sync.Mutex
	token   *tokenEntry
}

func NewSubtitles(cfg *SubtitleConfig) *Subtitles {
	return &Subtitles{cfg: cfg, client: http.DefaultClient}
}

// Configured reports whether OpenSubtitles credentials are present.
func (s *Subtitles) Configured() bool { return s.cfg != nil }

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

func (s *Subtitles) getAuthToken() (string, error) {
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
	re := regexp.MustCompile(`(?i)^tt`)
	numeric := re.ReplaceAllString(imdb, "")
	n, _ := strconv.Atoi(numeric)
	return n
}

func (s *Subtitles) SearchSubtitles(params SubtitleSearchParams) ([]SubtitleOption, error) {
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

func (s *Subtitles) DownloadSubtitleVTT(fileID int) (string, error) {
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

func (s *Subtitles) fetchSubtitleText(downloadURL string) (string, error) {
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
