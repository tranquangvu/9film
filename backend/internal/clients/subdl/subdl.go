// Package subdl is a client for the SubDL subtitle API (https://subdl.com).
//
// It speaks only SubDL: Search returns SubDL's own rows and Download returns the
// archive exactly as the CDN served it. Nothing here knows how NiceFilm labels,
// identifies or stores a subtitle — that mapping lives in the adapter in
// modules/subtitle, which is what keeps this package swappable.
package subdl

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bentran/nicefilm/backend/internal/clients/httpx"
)

// ErrRateLimited reports that SubDL refused the request because the account hit
// its rate limit or spent its quota. It is this package's own name for the
// condition, so a caller can match it without importing the HTTP helper this
// client happens to be built on.
var ErrRateLimited = errors.New("subdl: rate limit reached or quota exhausted")

// rateLimited restates the transport's throttling error as this package's, and
// with %v rather than %w so httpx stays out of the chain callers inspect.
func rateLimited(err error) error {
	if errors.Is(err, httpx.ErrRateLimited) {
		return fmt.Errorf("%w: %v", ErrRateLimited, err)
	}
	return err
}

const (
	// perPage is the page size asked of SubDL. Results are returned whole, so this
	// is the real ceiling on how many tracks a title can offer.
	perPage = 30
	// maxArchiveBytes bounds a download; subtitle archives are tens of kilobytes.
	maxArchiveBytes = 16 << 20
	userAgent       = "NiceFilm/1.0"
)

type Client struct {
	http         *http.Client
	apiBase      string
	downloadBase string
}

func New() *Client {
	return &Client{
		http:         &http.Client{Timeout: 15 * time.Second},
		apiBase:      "https://api.subdl.com/api/v1/subtitles",
		downloadBase: "https://dl.subdl.com",
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
	// Languages is a comma-separated list of ISO-ish codes ("en", "en-US"),
	// converted to SubDL's uppercase form on the way out.
	Languages string
}

// Subtitle is one row of a SubDL search result, trimmed to the fields that
// survive into a pickable track.
type Subtitle struct {
	// Path is the archive's path on the download host. SubDL splices the querying
	// account's API key into it; cleanPath removes that before anyone else sees it.
	Path        string
	ReleaseName string
	// Name is the archive filename, used as the release when ReleaseName is empty.
	Name string
	// Language is SubDL's own code, uppercase ("EN", "BR_PT").
	Language string
	// HI marks a hearing-impaired transcript.
	HI bool
}

func (c *Client) Search(apiKey string, p SearchParams) ([]Subtitle, error) {
	q := url.Values{}
	q.Set("api_key", apiKey)
	q.Set("type", p.MediaType)
	q.Set("languages", langCodes(p.Languages))
	q.Set("subs_per_page", strconv.Itoa(perPage))
	q.Set("releases", "1")
	q.Set("comment", "1")

	switch {
	case p.IMDbID != "":
		// SubDL wants the full "tt…" form, unlike OpenSubtitles' bare number.
		q.Set("imdb_id", normalizeIMDbID(p.IMDbID))
	case p.TMDbID > 0:
		q.Set("tmdb_id", strconv.Itoa(p.TMDbID))
	default:
		return nil, nil
	}
	if p.MediaType == "tv" && p.Season != nil {
		q.Set("season_number", strconv.Itoa(*p.Season))
		if p.Episode != nil {
			q.Set("episode_number", strconv.Itoa(*p.Episode))
		}
	}

	body, err := httpx.GetBytes(c.http, c.apiBase+"?"+q.Encode(), map[string]string{
		"User-Agent": userAgent,
		"Accept":     "application/json",
	}, maxArchiveBytes)
	if err != nil {
		return nil, fmt.Errorf("SubDL search: %w", rateLimited(err))
	}

	var result struct {
		Status    bool   `json:"status"`
		Error     string `json:"error"`
		Subtitles []struct {
			ReleaseName string `json:"release_name"`
			Name        string `json:"name"`
			Language    string `json:"language"` // "EN"
			Lang        string `json:"lang"`     // "english"
			URL         string `json:"url"`      // "/subtitle/3061891-3061999.zip"
			HI          bool   `json:"hi"`
		} `json:"subtitles"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode SubDL search: %w", err)
	}
	// SubDL reports failures inside a 200 response.
	if !result.Status {
		msg := result.Error
		if msg == "" {
			msg = "unknown error"
		}
		return nil, fmt.Errorf("SubDL search failed: %s", msg)
	}

	subs := make([]Subtitle, 0, len(result.Subtitles))
	for _, s := range result.Subtitles {
		// A row with no archive can't be downloaded, so it isn't a result.
		if s.URL == "" {
			continue
		}
		subs = append(subs, Subtitle{
			Path:        cleanPath(s.URL),
			ReleaseName: s.ReleaseName,
			Name:        s.Name,
			Language:    s.Language,
			HI:          s.HI,
		})
	}
	return subs, nil
}

// Download fetches an archive by its path and returns the raw bytes — a ZIP for
// SubDL, which the caller unpacks. Errors wrap ErrRateLimited when the account
// is throttled.
func (c *Client) Download(apiKey, archivePath string) ([]byte, error) {
	// Paths stored before cleanPath existed still carry "?api_key=…"; drop it here
	// too so an old one doesn't put a key (possibly a rotated one) back on the wire.
	archivePath = cleanPath(archivePath)
	if archivePath == "" {
		return nil, fmt.Errorf("SubDL download: empty archive path")
	}
	if !strings.HasPrefix(archivePath, "/") {
		archivePath = "/" + archivePath
	}

	headers := map[string]string{"User-Agent": userAgent, "Accept": "*/*"}
	if apiKey != "" {
		// Ignored on the free tier; paid keys authenticate downloads with it.
		headers["X-API-KEY"] = apiKey
	}

	raw, err := httpx.GetBytes(c.http, c.downloadBase+archivePath, headers, maxArchiveBytes)
	if err != nil {
		return nil, fmt.Errorf("SubDL download: %w", rateLimited(err))
	}
	return raw, nil
}

// cleanPath drops the query string from an archive path. Search results come
// back with the querying account's key already spliced in
// ("/subtitle/x.zip?api_key=…"), and the path travels onwards into the subtitle
// id handed to the browser — so leaving it would publish the server's shared key
// to anyone who can reach the search endpoint. The CDN serves the archive
// without it; Download authenticates with the X-API-KEY header instead.
func cleanPath(archivePath string) string {
	if i := strings.IndexByte(archivePath, '?'); i >= 0 {
		return archivePath[:i]
	}
	return archivePath
}

// langCodes converts ISO-ish codes to SubDL's uppercase ones ("en" -> "EN",
// "en-US" -> "EN"), defaulting to English.
func langCodes(langs string) string {
	out := make([]string, 0, 2)
	for _, part := range strings.Split(langs, ",") {
		code, _, _ := strings.Cut(strings.TrimSpace(part), "-")
		if code != "" {
			out = append(out, strings.ToUpper(code))
		}
	}
	if len(out) == 0 {
		return "EN"
	}
	return strings.Join(out, ",")
}

func normalizeIMDbID(id string) string {
	id = strings.ToLower(strings.TrimSpace(id))
	if id == "" || strings.HasPrefix(id, "tt") {
		return id
	}
	return "tt" + id
}
