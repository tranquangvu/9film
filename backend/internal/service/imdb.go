package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const imdbGraphQLURL = "https://api.graphql.imdb.com/"

// ErrTitleNotFound means the requested IMDb id doesn't resolve to a title —
// either it doesn't exist or it's malformed (e.g. "tt12"). Callers should treat
// this as a 404 / empty result rather than an upstream failure.
var ErrTitleNotFound = errors.New("title not found on IMDb")

// graphQLError is returned by imdbRequest when IMDb's GraphQL responds with a
// top-level `errors` array. For a single-title lookup this almost always means
// the id was rejected, so GetTitle maps it to ErrTitleNotFound.
type graphQLError struct{ msg string }

func (e *graphQLError) Error() string { return e.msg }

const titleCardFields = `
  id
  titleText { text }
  primaryImage { url width height }
  images(first: 8) { edges { node { url width height } } }
  ratingsSummary { aggregateRating voteCount }
  releaseYear { year endYear }
  releaseDate { day month year }
  titleType { id text canHaveEpisodes }
  genres { genres { text } }
  runtime { seconds }
  plot { plotText { plainText } }
  spokenLanguages { spokenLanguages { id text } }
  countriesOfOrigin { countries { text } }
`

const titleDetailFields = titleCardFields + `
  originalTitleText { text }
  episodes { episodes(first: 0) { total } seasons { number } }
  principalCredits {
    credits {
      name { id nameText { text } primaryImage { url } }
      ... on Cast { characters { name } }
    }
    category { text }
  }
`

type TextNode struct {
	Text string `json:"text,omitempty"`
}

type TitleType struct {
	ID              string `json:"id,omitempty"`
	Text            string `json:"text,omitempty"`
	CanHaveEpisodes bool   `json:"canHaveEpisodes,omitempty"`
}

type ReleaseYear struct {
	Year    *int `json:"year,omitempty"`
	EndYear *int `json:"endYear,omitempty"`
}

type ReleaseDate struct {
	Day   *int `json:"day,omitempty"`
	Month *int `json:"month,omitempty"`
	Year  *int `json:"year,omitempty"`
}

type Image struct {
	URL    string `json:"url,omitempty"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

type PlotNode struct {
	PlotText *PlainText `json:"plotText,omitempty"`
}

type PlainText struct {
	PlainText string `json:"plainText,omitempty"`
}

type RatingsSummary struct {
	AggregateRating *float64 `json:"aggregateRating,omitempty"`
	VoteCount       *int     `json:"voteCount,omitempty"`
}

type Runtime struct {
	Seconds *int `json:"seconds,omitempty"`
}

type GenresWrapper struct {
	Genres []TextNode `json:"genres,omitempty"`
}

type LanguageWrapper struct {
	SpokenLanguages []LanguageItem `json:"spokenLanguages,omitempty"`
}

type LanguageItem struct {
	ID   string `json:"id,omitempty"`
	Text string `json:"text,omitempty"`
}

type CountriesWrapper struct {
	Countries []TextNode `json:"countries,omitempty"`
}

type CreditName struct {
	ID           string    `json:"id,omitempty"`
	NameText     *TextNode `json:"nameText,omitempty"`
	PrimaryImage *Image    `json:"primaryImage,omitempty"`
}

type Character struct {
	Name string `json:"name,omitempty"`
}

type Credit struct {
	Name       *CreditName `json:"name,omitempty"`
	Characters []Character `json:"characters,omitempty"`
}

type CreditCategory struct {
	Text string `json:"text,omitempty"`
}

type PrincipalCreditGroup struct {
	Credits  []Credit        `json:"credits,omitempty"`
	Category *CreditCategory `json:"category,omitempty"`
}

type ImagesConnection struct {
	Edges []struct {
		Node Image `json:"node"`
	} `json:"edges,omitempty"`
}

type EpisodesConnection struct {
	Episodes *struct {
		Total int `json:"total,omitempty"`
	} `json:"episodes,omitempty"`
	Seasons []struct {
		Number int `json:"number,omitempty"`
	} `json:"seasons,omitempty"`
}

type ImdbTitle struct {
	ID                string                 `json:"id,omitempty"`
	TitleText         *TextNode              `json:"titleText,omitempty"`
	OriginalTitleText *TextNode              `json:"originalTitleText,omitempty"`
	TitleType         *TitleType             `json:"titleType,omitempty"`
	ReleaseYear       *ReleaseYear           `json:"releaseYear,omitempty"`
	ReleaseDate       *ReleaseDate           `json:"releaseDate,omitempty"`
	PrimaryImage      *Image                 `json:"primaryImage,omitempty"`
	Plot              *PlotNode              `json:"plot,omitempty"`
	RatingsSummary    *RatingsSummary        `json:"ratingsSummary,omitempty"`
	Runtime           *Runtime               `json:"runtime,omitempty"`
	Genres            *GenresWrapper         `json:"genres,omitempty"`
	SpokenLanguages   *LanguageWrapper       `json:"spokenLanguages,omitempty"`
	CountriesOfOrigin *CountriesWrapper      `json:"countriesOfOrigin,omitempty"`
	PrincipalCredits  []PrincipalCreditGroup `json:"principalCredits,omitempty"`
	Images            *ImagesConnection      `json:"images,omitempty"`
	Episodes          *EpisodesConnection    `json:"episodes,omitempty"`
}

type BrowseParams struct {
	Type      string
	Genre     string
	First     int
	After     string
	MinRating *float64
	// Sort selects an advancedTitleSearch ordering: "latest" (newest release first),
	// "popular" (most popular first), or "rating" (highest user rating first).
	// Empty falls back to IMDb's default relevance order.
	Sort string
}

type BrowseResult struct {
	Titles      []ImdbTitle `json:"titles"`
	HasNextPage bool        `json:"hasNextPage"`
	EndCursor   string      `json:"endCursor,omitempty"`
}

type graphqlRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

func normalizeImdbID(id string) string {
	if strings.HasPrefix(id, "tt") {
		return id
	}
	return "tt" + id
}

func releaseCutoff() time.Time {
	return time.Now().UTC().AddDate(0, -6, 0)
}

func imdbRequest(query string, variables map[string]any, dataTarget any) error {
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

	resp, err := http.DefaultClient.Do(req)
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

func GetTitle(imdbID string) (*ImdbTitle, error) {
	id := normalizeImdbID(imdbID)
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
	if err := imdbRequest(query, map[string]any{"id": id}, &data); err != nil {
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
	return data.Title, nil
}

func SearchTitles(term string, limit int) ([]ImdbTitle, error) {
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
	if err := imdbRequest(query, map[string]any{"first": limit, "constraints": constraints}, &data); err != nil {
		return nil, err
	}

	titles := make([]ImdbTitle, 0, len(data.AdvancedTitleSearch.Edges))
	for _, edge := range data.AdvancedTitleSearch.Edges {
		if edge.Node.Title.ID != "" {
			titles = append(titles, edge.Node.Title)
		}
	}
	return titles, nil
}

func TrendingTitles(limit int) ([]ImdbTitle, error) {
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
	if err := imdbRequest(query, map[string]any{"limit": limit}, &data); err != nil {
		return nil, err
	}

	titles := make([]ImdbTitle, 0, len(data.TrendingTitles.Titles))
	for _, title := range data.TrendingTitles.Titles {
		if title.ID != "" {
			titles = append(titles, title)
		}
	}
	return titles, nil
}

func BrowseTitles(params BrowseParams) (*BrowseResult, error) {
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
	if err := imdbRequest(query, variables, &data); err != nil {
		return nil, err
	}

	result := &BrowseResult{
		HasNextPage: data.AdvancedTitleSearch.PageInfo.HasNextPage,
		EndCursor:   data.AdvancedTitleSearch.PageInfo.EndCursor,
	}
	for _, edge := range data.AdvancedTitleSearch.Edges {
		if edge.Node.Title.ID != "" {
			result.Titles = append(result.Titles, edge.Node.Title)
		}
	}
	return result, nil
}

func SimilarTitles(imdbID string, limit int) ([]ImdbTitle, error) {
	title, err := GetTitle(imdbID)
	if err != nil {
		return nil, err
	}
	genre := ""
	if title.Genres != nil && len(title.Genres.Genres) > 0 {
		genre = title.Genres.Genres[0].Text
	}
	if genre == "" {
		return nil, nil
	}

	mediaType := "movie"
	if title.TitleType != nil {
		switch title.TitleType.ID {
		case "tvSeries", "tvMiniSeries", "tvMovie", "tvSpecial":
			mediaType = "tv"
		}
	}

	result, err := BrowseTitles(BrowseParams{
		Type:  mediaType,
		Genre: genre,
		First: limit + 5,
	})
	if err != nil {
		return nil, err
	}

	filtered := make([]ImdbTitle, 0, limit)
	for _, item := range result.Titles {
		if item.ID == title.ID {
			continue
		}
		filtered = append(filtered, item)
		if len(filtered) >= limit {
			break
		}
	}
	return filtered, nil
}
