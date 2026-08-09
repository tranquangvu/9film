package subtitle

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// subsPerPage is SubDL's page size; the frontend only shows the top few, but a
// wide page gives its release-name heuristic something to work with.
const subdlPerPage = 30

// Upstream endpoints, isolated here so the source can be swapped (and pointed at
// a test server) without touching the rest of the provider.
var (
	subdlAPIBase      = "https://api.subdl.com/api/v1/subtitles"
	subdlDownloadBase = "https://dl.subdl.com"
)

type subdl struct{ client *http.Client }

func NewSubDL() Provider {
	return &subdl{client: &http.Client{Timeout: 15 * time.Second}}
}

func (p *subdl) Name() string { return ProviderSubDL }

func (p *subdl) Search(creds Creds, params SubtitleSearchParams) ([]SubtitleOption, error) {
	q := url.Values{}
	q.Set("api_key", creds.APIKey)
	q.Set("type", params.MediaType)
	q.Set("languages", subdlLang(params.Languages))
	q.Set("subs_per_page", strconv.Itoa(subdlPerPage))
	q.Set("releases", "1")
	q.Set("comment", "1")

	switch {
	case params.IMDbID != "":
		// SubDL wants the full "tt…" form, unlike OpenSubtitles' bare number.
		q.Set("imdb_id", normalizeIMDbID(params.IMDbID))
	case params.TMDbID > 0:
		q.Set("tmdb_id", strconv.Itoa(params.TMDbID))
	default:
		return nil, nil
	}
	if params.MediaType == "tv" && params.Season != nil {
		q.Set("season_number", strconv.Itoa(*params.Season))
		if params.Episode != nil {
			q.Set("episode_number", strconv.Itoa(*params.Episode))
		}
	}

	body, err := fetchBytes(p.client, subdlAPIBase+"?"+q.Encode(), map[string]string{
		"User-Agent": userAgent,
		"Accept":     "application/json",
	})
	if err != nil {
		return nil, fmt.Errorf("SubDL search: %w", err)
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

	options := make([]SubtitleOption, 0, len(result.Subtitles))
	for _, s := range result.Subtitles {
		if s.URL == "" {
			continue
		}
		release := s.ReleaseName
		if release == "" {
			release = s.Name
		}
		// Lowercased to match <track srclang> and the frontend's preferred-language
		// prefix test. SubDL's regional codes (BR_PT, ZH_BG) aren't ISO, but they
		// only ever have to compare equal to themselves.
		lang := strings.ToLower(s.Language)
		if lang == "" {
			lang = "und"
		}
		label := strings.ToUpper(lang)
		if release != "" {
			label += " — " + release
		}
		if s.HI {
			label += " (HI)"
		}
		options = append(options, SubtitleOption{
			ID:       FormatID(ProviderSubDL, subdlRef(s.URL, params)),
			Language: lang,
			Label:    label,
			Release:  release,
			// SubDL publishes no download count; results are already in relevance
			// order and the frontend's sort preserves it (see SubtitleOption).
		})
	}
	return options, nil
}

// DownloadVTT takes "<archive path>[|SxxEyy]" as its ref — see subdlRef.
func (p *subdl) DownloadVTT(creds Creds, ref string) (string, error) {
	archivePath, hint, _ := strings.Cut(ref, "|")
	// Ids minted before stripQuery existed still carry "?api_key=…"; drop it here
	// too so an old id doesn't put a key (possibly a rotated one) back on the wire.
	archivePath = stripQuery(archivePath)
	if archivePath == "" {
		return "", fmt.Errorf("invalid SubDL subtitle ref %q", ref)
	}
	if !strings.HasPrefix(archivePath, "/") {
		archivePath = "/" + archivePath
	}

	headers := map[string]string{"User-Agent": userAgent, "Accept": "*/*"}
	if creds.APIKey != "" {
		// Ignored on the free tier; paid keys authenticate downloads with it.
		headers["X-API-KEY"] = creds.APIKey
	}

	raw, err := fetchBytes(p.client, subdlDownloadBase+archivePath, headers)
	if err != nil {
		return "", fmt.Errorf("SubDL download: %w", err)
	}
	name, data, err := subtitleFromArchive(raw, hint)
	if err != nil {
		return "", fmt.Errorf("SubDL download: %w", err)
	}
	return toVTT(name, data)
}

// subdlRef pins the requested episode to the archive path. SubDL returns whole
// season packs alongside per-episode subtitles, and a pack's ZIP holds one file
// per episode — the path alone can't say which. '|' can't appear in a SubDL path
// and doesn't collide with the ':' that ParseID splits on, so the ref stays
// opaque to everything above this provider.
func subdlRef(archivePath string, p SubtitleSearchParams) string {
	archivePath = stripQuery(archivePath)
	if p.MediaType == "tv" && p.Season != nil && p.Episode != nil {
		return fmt.Sprintf("%s|S%02dE%02d", archivePath, *p.Season, *p.Episode)
	}
	return archivePath
}

// stripQuery drops the query string from a SubDL archive path. Search results
// come back with the account's own key already spliced in
// ("/subtitle/x.zip?api_key=…"), and the path becomes part of the subtitle id
// that is handed to the browser and stored in watch history — so leaving it
// would publish the server's shared key to every caller of /api/subtitle/search.
// dl.subdl.com serves the archive without it; DownloadVTT authenticates with the
// X-API-KEY header instead.
func stripQuery(archivePath string) string {
	if i := strings.IndexByte(archivePath, '?'); i >= 0 {
		return archivePath[:i]
	}
	return archivePath
}

// subdlLang converts our ISO-ish codes to SubDL's uppercase ones ("en" -> "EN",
// "en-US" -> "EN"), defaulting to English.
func subdlLang(langs string) string {
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
