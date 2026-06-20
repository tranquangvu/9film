package title

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Repository serves the IMDb GraphQL integration. Methods return the raw,
// unflattened ImdbTitle shape; the Service flattens into the Title DTO. The
// default implementation owns the HTTP client and the short-lived per-title
// detail cache, so a single instance keeps the cache coherent across callers.
type Repository interface {
	FetchTitle(imdbID string) (*ImdbTitle, error)
	SearchTitles(term string, limit int) ([]ImdbTitle, error)
	TrendingTitles(limit int) ([]ImdbTitle, error)
	BrowseTitles(params BrowseParams) (*rawBrowseResult, error)
}

type repository struct {
	client  *http.Client
	cacheMu sync.RWMutex
	cache   map[string]titleCacheEntry
}

func NewRepository() Repository {
	return &repository{client: http.DefaultClient, cache: make(map[string]titleCacheEntry)}
}

func (r *repository) imdbRequest(query string, variables map[string]any, dataTarget any) error {
	payload, err := json.Marshal(graphqlRequest{Query: query, Variables: variables})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, imdbGraphQLURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NiceFilm/1.0")

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("IMDb GraphQL request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("IMDb GraphQL failed (%d)", resp.StatusCode)
	}

	var raw struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return fmt.Errorf("decode IMDb response: %w", err)
	}
	if len(raw.Errors) > 0 {
		return &graphQLError{fmt.Sprintf("IMDb GraphQL error: %s", raw.Errors[0].Message)}
	}
	if len(raw.Data) == 0 {
		return fmt.Errorf("empty IMDb response")
	}
	return json.Unmarshal(raw.Data, dataTarget)
}

func (r *repository) cachedTitle(id string) *ImdbTitle {
	r.cacheMu.RLock()
	e, ok := r.cache[id]
	r.cacheMu.RUnlock()
	if ok && time.Now().Before(e.exp) {
		return e.title
	}
	return nil
}

func (r *repository) storeTitle(id string, t *ImdbTitle) {
	r.cacheMu.Lock()
	r.cache[id] = titleCacheEntry{title: t, exp: time.Now().Add(titleCacheTTL)}
	r.cacheMu.Unlock()
}

// FetchTitle returns the raw IMDb title (cached).
func (r *repository) FetchTitle(imdbID string) (*ImdbTitle, error) {
	id := normalizeImdbID(imdbID)
	if t := r.cachedTitle(id); t != nil {
		return t, nil
	}
	query := fmt.Sprintf(`
	  query TitleDetails($id: ID!) {
	    title(id: $id) {
	      %s
	    }
	  }
	`, titleDetailFields)

	var data struct {
		Title *ImdbTitle `json:"title"`
	}
	if err := r.imdbRequest(query, map[string]any{"id": id}, &data); err != nil {
		// A GraphQL error on a title lookup means the id was rejected — treat it
		// as "not found" rather than an upstream failure.
		var gqlErr *graphQLError
		if errors.As(err, &gqlErr) {
			return nil, ErrTitleNotFound
		}
		return nil, err
	}
	if data.Title == nil || data.Title.ID == "" {
		return nil, ErrTitleNotFound
	}
	r.storeTitle(id, data.Title)
	return data.Title, nil
}

// SearchTitles returns raw IMDb titles matching the search term (image-filtered).
func (r *repository) SearchTitles(term string, limit int) ([]ImdbTitle, error) {
	term = strings.TrimSpace(term)
	if term == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}

	constraints := map[string]any{
		"titleTextConstraint": map[string]any{
			"searchTerm": term,
		},
		// Share the same condition as the other list queries: only titles the
		// user can actually watch (released on or before the cutoff).
		"releaseDateConstraint": map[string]any{
			"releaseDateRange": map[string]any{
				"end": releaseCutoff().Format(time.DateOnly),
			},
		},
	}

	query := fmt.Sprintf(`
	  query SearchTitles($first: Int!, $constraints: AdvancedTitleSearchConstraints!) {
	    advancedTitleSearch(first: $first, constraints: $constraints) {
	      edges {
	        node {
	          title { %s }
	        }
	      }
	    }
	  }
	`, titleCardFields)

	var data struct {
		AdvancedTitleSearch struct {
			Edges []struct {
				Node struct {
					Title ImdbTitle `json:"title"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"advancedTitleSearch"`
	}
	if err := r.imdbRequest(query, map[string]any{"first": limit, "constraints": constraints}, &data); err != nil {
		return nil, err
	}

	titles := make([]ImdbTitle, 0, len(data.AdvancedTitleSearch.Edges))
	for _, edge := range data.AdvancedTitleSearch.Edges {
		if edge.Node.Title.ID != "" && edge.Node.Title.hasImage() {
			titles = append(titles, edge.Node.Title)
		}
	}
	return titles, nil
}

// TrendingTitles returns raw trending IMDb titles (image-filtered).
func (r *repository) TrendingTitles(limit int) ([]ImdbTitle, error) {
	if limit <= 0 {
		limit = 10
	}

	query := fmt.Sprintf(`
	  query TrendingTitles($limit: Int!) {
	    trendingTitles(limit: $limit) {
	      titles { %s }
	    }
	  }
	`, titleCardFields)

	var data struct {
		TrendingTitles struct {
			Titles []ImdbTitle `json:"titles"`
		} `json:"trendingTitles"`
	}
	if err := r.imdbRequest(query, map[string]any{"limit": limit}, &data); err != nil {
		return nil, err
	}

	titles := make([]ImdbTitle, 0, len(data.TrendingTitles.Titles))
	for _, title := range data.TrendingTitles.Titles {
		// Skip imageless titles — they render as empty cards in the UI.
		if title.ID != "" && title.hasImage() {
			titles = append(titles, title)
		}
	}
	return titles, nil
}

// rawBrowseResult carries the raw browse titles plus paging info.
type rawBrowseResult struct {
	Titles      []ImdbTitle
	HasNextPage bool
	EndCursor   string
}

// BrowseTitles returns a raw, paged browse result (image-filtered titles).
func (r *repository) BrowseTitles(params BrowseParams) (*rawBrowseResult, error) {
	first := params.First
	if first <= 0 {
		first = 20
	}

	typeConstraint := []string{"movie", "tvSeries", "tvMiniSeries"}
	switch params.Type {
	case "movie":
		typeConstraint = []string{"movie"}
	case "tv":
		typeConstraint = []string{"tvSeries", "tvMiniSeries", "tvMovie", "tvSpecial"}
	}

	constraints := map[string]any{
		"titleTypeConstraint": map[string]any{
			"anyTitleTypeIds": typeConstraint,
		},
		// Only surface titles the user can actually watch; cap the range at the
		// shared cutoff so recently/just-released titles without streams are excluded.
		"releaseDateConstraint": map[string]any{
			"releaseDateRange": map[string]any{
				"end": releaseCutoff().Format(time.DateOnly),
			},
		},
	}
	if params.Genre != "" {
		constraints["genreConstraint"] = map[string]any{
			"anyGenreIds": []string{params.Genre},
		}
	}
	if params.MinRating != nil {
		constraints["ratingsConstraint"] = map[string]any{
			"minRating": *params.MinRating,
		}
	}

	var sort map[string]any
	switch params.Sort {
	case "latest":
		sort = map[string]any{"sortBy": "RELEASE_DATE", "sortOrder": "DESC"}
	case "popular":
		sort = map[string]any{"sortBy": "POPULARITY", "sortOrder": "ASC"}
	case "rating":
		sort = map[string]any{"sortBy": "USER_RATING", "sortOrder": "DESC"}
	}

	variables := map[string]any{
		"first":       first,
		"constraints": constraints,
	}
	if sort != nil {
		variables["sort"] = sort
	}
	if params.After != "" {
		variables["after"] = params.After
	}

	query := fmt.Sprintf(`
	  query BrowseTitles($first: Int!, $constraints: AdvancedTitleSearchConstraints!, $sort: AdvancedTitleSearchSort, $after: String) {
	    advancedTitleSearch(first: $first, after: $after, sort: $sort, constraints: $constraints) {
	      edges {
	        node {
	          title { %s }
	        }
	      }
	      pageInfo {
	        hasNextPage
	        endCursor
	      }
	    }
	  }
	`, titleCardFields)

	var data struct {
		AdvancedTitleSearch struct {
			Edges []struct {
				Node struct {
					Title ImdbTitle `json:"title"`
				} `json:"node"`
			} `json:"edges"`
			PageInfo struct {
				HasNextPage bool   `json:"hasNextPage"`
				EndCursor   string `json:"endCursor"`
			} `json:"pageInfo"`
		} `json:"advancedTitleSearch"`
	}
	if err := r.imdbRequest(query, variables, &data); err != nil {
		return nil, err
	}

	result := &rawBrowseResult{
		HasNextPage: data.AdvancedTitleSearch.PageInfo.HasNextPage,
		EndCursor:   data.AdvancedTitleSearch.PageInfo.EndCursor,
	}
	for _, edge := range data.AdvancedTitleSearch.Edges {
		// Skip imageless titles — they render as empty cards in the UI.
		if edge.Node.Title.ID != "" && edge.Node.Title.hasImage() {
			result.Titles = append(result.Titles, edge.Node.Title)
		}
	}
	return result, nil
}
