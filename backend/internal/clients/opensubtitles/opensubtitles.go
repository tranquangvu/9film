// Package opensubtitles is a client for the OpenSubtitles REST API
// (https://opensubtitles.com).
//
// It is NOT wired into the running app — see the adapter in modules/subtitle for
// what that would take. The client is kept whole and compiling so it doesn't rot
// and so switching back stays a wiring change rather than a rewrite.
//
// Like the other provider clients it speaks only its vendor: Search returns
// OpenSubtitles' own rows, Download returns the file the CDN served.
package opensubtitles

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bentran/9film/backend/internal/clients/httpx"
)

// ErrRateLimited reports that OpenSubtitles refused the request because the
// account is throttled (429) or has spent its daily download quota (406). It is
// this package's own name for the condition, so a caller can match it without
// importing the HTTP helper this client happens to be built on.
var ErrRateLimited = errors.New("opensubtitles: rate limit reached or download quota exhausted")

// rateLimited restates the transport's throttling error as this package's, and
// with %v rather than %w so httpx stays out of the chain callers inspect.
func rateLimited(err error) error {
	if errors.Is(err, httpx.ErrRateLimited) {
		return fmt.Errorf("%w: %v", ErrRateLimited, err)
	}
	return err
}

const (
	maxDownloadBytes = 16 << 20
	userAgent        = "9Film/1.0"
)

// Credentials are one account's login. Search needs the API key alone; Download
// also needs the username and password, which buy a short-lived bearer token.
type Credentials struct {
	APIKey   string
	Username string
	Password string
}

type tokenEntry struct {
	token     string
	expiresAt time.Time
}

type Client struct {
	http    *http.Client
	apiBase string

	tokenMu sync.Mutex
	tokens  map[string]*tokenEntry // keyed by username
}

func New() *Client {
	return &Client{
		http:    &http.Client{Timeout: 15 * time.Second},
		apiBase: "https://api.opensubtitles.com/api/v1",
		tokens:  map[string]*tokenEntry{},
	}
}

// SearchParams is one subtitle lookup. Either IMDbID or TMDbID must be set;
// Season/Episode narrow a "tv" search to a single episode.
type SearchParams struct {
	IMDbID    string
	TMDbID    int
	MediaType string
	Season    *int
	Episode   *int
	Languages string
}

// Subtitle is one row of a search result, trimmed to what survives into a
// pickable track. FileID is the handle Download takes.
type Subtitle struct {
	FileID        int
	Language      string
	Release       string
	DownloadCount int
}

func (c *Client) headers(apiKey string) map[string]string {
	return map[string]string{
		"Api-Key":    apiKey,
		"User-Agent": userAgent,
		"Accept":     "application/json",
	}
}

func (c *Client) Search(creds Credentials, p SearchParams) ([]Subtitle, error) {
	q := url.Values{}
	lang := p.Languages
	if lang == "" {
		lang = "en"
	}
	q.Set("languages", lang)
	q.Set("order_by", "new_download_count")
	q.Set("order_direction", "desc")

	switch {
	case p.IMDbID != "":
		numeric := imdbToNumeric(p.IMDbID)
		if p.MediaType == "tv" && p.Season != nil && p.Episode != nil {
			q.Set("parent_imdb_id", strconv.Itoa(numeric))
			q.Set("season_number", strconv.Itoa(*p.Season))
			q.Set("episode_number", strconv.Itoa(*p.Episode))
		} else {
			q.Set("imdb_id", strconv.Itoa(numeric))
		}
	case p.TMDbID > 0:
		if p.MediaType == "tv" && p.Season != nil && p.Episode != nil {
			q.Set("parent_tmdb_id", strconv.Itoa(p.TMDbID))
			q.Set("season_number", strconv.Itoa(*p.Season))
			q.Set("episode_number", strconv.Itoa(*p.Episode))
		} else {
			q.Set("tmdb_id", strconv.Itoa(p.TMDbID))
		}
	default:
		return nil, nil
	}

	req, _ := http.NewRequest(http.MethodGet, c.apiBase+"/subtitles?"+q.Encode(), nil)
	httpx.ApplyHeaders(req, c.headers(creds.APIKey))

	resp, err := c.http.Do(req)
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

	subs := make([]Subtitle, 0, len(result.Data))
	for _, item := range result.Data {
		attr := item.Attributes
		// Without a file id there is nothing to download, so it isn't a result.
		if len(attr.Files) == 0 || attr.Files[0].FileID == 0 {
			continue
		}
		count := attr.NewDownloadCount
		if count == 0 {
			count = attr.DownloadCount
		}
		subs = append(subs, Subtitle{
			FileID:        attr.Files[0].FileID,
			Language:      attr.Language,
			Release:       attr.Release,
			DownloadCount: count,
		})
	}
	return subs, nil
}

// Download resolves a file id to a one-shot CDN link and fetches it, returning
// the raw body together with the link's filename — the body may be a bare
// subtitle with no name of its own, and the extension decides how to decode it.
// Errors wrap ErrRateLimited when the account is throttled or out of quota.
func (c *Client) Download(creds Credentials, fileID int) (data []byte, filename string, err error) {
	if fileID <= 0 {
		return nil, "", fmt.Errorf("invalid OpenSubtitles file id %d", fileID)
	}
	if creds.Username == "" || creds.Password == "" {
		return nil, "", fmt.Errorf("OpenSubtitles download requires a username and password")
	}

	token, err := c.authToken(creds)
	if err != nil {
		return nil, "", err
	}

	payload, _ := json.Marshal(map[string]int{"file_id": fileID})
	req, _ := http.NewRequest(http.MethodPost, c.apiBase+"/download", bytes.NewReader(payload))
	httpx.ApplyHeaders(req, c.headers(creds.APIKey))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("OpenSubtitles download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// 429 = rate-limited; 406 = daily download quota exhausted.
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusNotAcceptable {
			return nil, "", fmt.Errorf("%w: %s", ErrRateLimited, strings.TrimSpace(string(body)))
		}
		return nil, "", fmt.Errorf("OpenSubtitles download failed (%d): %s", resp.StatusCode, string(body))
	}

	var dlResult struct {
		Link string `json:"link"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dlResult); err != nil || dlResult.Link == "" {
		return nil, "", fmt.Errorf("OpenSubtitles: no link in download response")
	}

	raw, err := httpx.GetBytes(c.http, dlResult.Link, map[string]string{"User-Agent": userAgent}, maxDownloadBytes)
	if err != nil {
		return nil, "", rateLimited(err)
	}
	return raw, fileNameFromURL(dlResult.Link), nil
}

// authToken returns a cached bearer token for the account, logging in when there
// isn't a live one. Tokens last 24h upstream; 23 leaves room for clock skew.
func (c *Client) authToken(creds Credentials) (string, error) {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	if t := c.tokens[creds.Username]; t != nil && time.Now().Before(t.expiresAt) {
		return t.token, nil
	}

	payload, _ := json.Marshal(map[string]string{
		"username": creds.Username,
		"password": creds.Password,
	})
	req, _ := http.NewRequest(http.MethodPost, c.apiBase+"/login", bytes.NewReader(payload))
	httpx.ApplyHeaders(req, c.headers(creds.APIKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
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

	c.tokens[creds.Username] = &tokenEntry{
		token:     result.Token,
		expiresAt: time.Now().Add(23 * time.Hour),
	}
	return result.Token, nil
}

func imdbToNumeric(imdb string) int {
	n, _ := strconv.Atoi(strings.TrimPrefix(strings.ToLower(imdb), "tt"))
	return n
}

func fileNameFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return path.Base(u.Path)
}
