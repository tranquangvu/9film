package subtitle

// OpenSubtitles was the original subtitle source. It is no longer the default
// (see SUBTITLE_PROVIDER) but stays registered so ids saved under it keep
// downloading, and so switching back is a config change.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

const openSubsAPIBase = "https://api.opensubtitles.com/api/v1"

type tokenEntry struct {
	token     string
	expiresAt time.Time
}

// openSubtitles proxies the OpenSubtitles API using the caller-supplied
// credentials, caching one auth token per OpenSubtitles account.
type openSubtitles struct {
	client  *http.Client
	tokenMu sync.Mutex
	tokens  map[string]*tokenEntry // keyed by OpenSubtitles username
}

func NewOpenSubtitles() Provider {
	return &openSubtitles{client: &http.Client{Timeout: 15 * time.Second}, tokens: map[string]*tokenEntry{}}
}

func (s *openSubtitles) Name() string { return ProviderOpenSubtitles }

func baseSubsHeaders(apiKey string) map[string]string {
	return map[string]string{
		"Api-Key":    apiKey,
		"User-Agent": userAgent,
		"Accept":     "application/json",
	}
}

func (s *openSubtitles) getAuthToken(creds Creds) (string, error) {
	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()

	if t := s.tokens[creds.Username]; t != nil && time.Now().Before(t.expiresAt) {
		return t.token, nil
	}

	payload, _ := json.Marshal(map[string]string{
		"username": creds.Username,
		"password": creds.Password,
	})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/login", bytes.NewReader(payload))
	applyHeaders(req, baseSubsHeaders(creds.APIKey))
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

	s.tokens[creds.Username] = &tokenEntry{
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

func (s *openSubtitles) Search(creds Creds, params SubtitleSearchParams) ([]SubtitleOption, error) {
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
	applyHeaders(req, baseSubsHeaders(creds.APIKey))

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
			ID:            FormatID(ProviderOpenSubtitles, strconv.Itoa(file.FileID)),
			Language:      lang,
			Label:         label,
			DownloadCount: count,
			Release:       attr.Release,
		})
	}

	return options, nil
}

// DownloadVTT takes an OpenSubtitles file id as its ref.
func (s *openSubtitles) DownloadVTT(creds Creds, ref string) (string, error) {
	fileID, err := strconv.Atoi(ref)
	if err != nil || fileID <= 0 {
		return "", fmt.Errorf("invalid OpenSubtitles file id %q", ref)
	}
	if creds.Username == "" || creds.Password == "" {
		return "", fmt.Errorf("OpenSubtitles download requires a username and password")
	}

	token, err := s.getAuthToken(creds)
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(map[string]int{"file_id": fileID})
	req, _ := http.NewRequest(http.MethodPost, openSubsAPIBase+"/download", bytes.NewReader(payload))
	applyHeaders(req, baseSubsHeaders(creds.APIKey))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OpenSubtitles download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// 429 = rate-limited; 406 = daily download quota exhausted.
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusNotAcceptable {
			return "", fmt.Errorf("%w: %s", ErrRateLimited, strings.TrimSpace(string(body)))
		}
		return "", fmt.Errorf("OpenSubtitles download failed (%d): %s", resp.StatusCode, string(body))
	}

	var dlResult struct {
		Link string `json:"link"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dlResult); err != nil || dlResult.Link == "" {
		return "", fmt.Errorf("OpenSubtitles: no link in download response")
	}

	raw, err := fetchBytes(s.client, dlResult.Link, map[string]string{"User-Agent": userAgent})
	if err != nil {
		return "", err
	}
	name, data, err := subtitleFromArchive(raw, "")
	if err != nil {
		return "", err
	}
	if name == "" {
		// A plain (or header-less gzip) body: the link's own filename decides
		// whether this is already VTT.
		name = fileNameFromURL(dlResult.Link)
	}
	return toVTT(name, data)
}

func fileNameFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return path.Base(u.Path)
}
