package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const imdbGraphQLURL = "https://api.graphql.imdb.com/"

const titleCardFields = `
  id
  titleText { text }
  primaryImage { url width height }
  ratingsSummary { aggregateRating voteCount }
  releaseYear { year endYear }
  titleType { id text canHaveEpisodes }
  genres { genres { text } }
  runtime { seconds }
  plot { plotText { plainText } }
  spokenLanguages { spokenLanguages { id text } }
  countriesOfOrigin { countries { text } }
`

const titleDetailFields = titleCardFields + `
  originalTitleText { text }
  images(first: 1) { edges { node { url width height } } }
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

type ImdbTitle struct {
	ID                string                 `json:"id,omitempty"`
	TitleText         *TextNode              `json:"titleText,omitempty"`
	OriginalTitleText *TextNode              `json:"originalTitleText,omitempty"`
	TitleType         *TitleType             `json:"titleType,omitempty"`
	ReleaseYear       *ReleaseYear           `json:"releaseYear,omitempty"`
	PrimaryImage      *Image                 `json:"primaryImage,omitempty"`
	Plot              *PlotNode              `json:"plot,omitempty"`
	RatingsSummary    *RatingsSummary        `json:"ratingsSummary,omitempty"`
	Runtime           *Runtime               `json:"runtime,omitempty"`
	Genres            *GenresWrapper         `json:"genres,omitempty"`
	SpokenLanguages   *LanguageWrapper       `json:"spokenLanguages,omitempty"`
	CountriesOfOrigin *CountriesWrapper      `json:"countriesOfOrigin,omitempty"`
	PrincipalCredits  []PrincipalCreditGroup `json:"principalCredits,omitempty"`
	Images            *ImagesConnection      `json:"images,omitempty"`
}

type BrowseParams struct {
	Type      string
	Genre     string
	First     int
	After     string
	MinRating *float64
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
		return fmt.Errorf("IMDb GraphQL error: %s", raw.Errors[0].Message)
	}
	if len(raw.Data) == 0 {
		return fmt.Errorf("empty IMDb response")
	}
	return json.Unmarshal(raw.Data, dataTarget)
}

func FetchTitle(imdbID string) (*ImdbTitle, error) {
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
		return nil, err
	}
	if data.Title == nil || data.Title.ID == "" {
		return nil, fmt.Errorf("title not found on IMDb: %s", id)
	}
	return data.Title, nil
}

func FetchPopular(limit int) ([]ImdbTitle, error) {
	if limit <= 0 {
		limit = 20
	}
	query := fmt.Sprintf(`
	  query PopularTitles($limit: Int!) {
	    popularTitles(limit: $limit) {
	      titles { %s }
	    }
	  }
	`, titleCardFields)

	var data struct {
		PopularTitles struct {
			Titles []ImdbTitle `json:"titles"`
		} `json:"popularTitles"`
	}
	if err := imdbRequest(query, map[string]any{"limit": limit}, &data); err != nil {
		return nil, err
	}
	return data.PopularTitles.Titles, nil
}

func FetchTrending(limit int) ([]ImdbTitle, error) {
	if limit <= 0 {
		limit = 20
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
	return data.TrendingTitles.Titles, nil
}

func SearchTitles(term string, limit int) ([]ImdbTitle, error) {
	term = strings.TrimSpace(term)
	if term == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}

	query := fmt.Sprintf(`
	  query SearchTitles($term: String!, $first: Int!) {
	    mainSearch(first: $first, options: { searchTerm: $term, type: TITLE }) {
	      edges {
	        node {
	          entity {
	            ... on Title { %s }
	          }
	        }
	      }
	    }
	  }
	`, titleCardFields)

	var data struct {
		MainSearch struct {
			Edges []struct {
				Node struct {
					Entity ImdbTitle `json:"entity"`
				} `json:"node"`
			} `json:"edges"`
		} `json:"mainSearch"`
	}
	if err := imdbRequest(query, map[string]any{"term": term, "first": limit}, &data); err != nil {
		return nil, err
	}

	titles := make([]ImdbTitle, 0, len(data.MainSearch.Edges))
	for _, edge := range data.MainSearch.Edges {
		if edge.Node.Entity.ID != "" {
			titles = append(titles, edge.Node.Entity)
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
	case "tv", "series":
		typeConstraint = []string{"tvSeries", "tvMiniSeries", "tvSpecial"}
	}

	constraints := map[string]any{
		"titleTypeConstraint": map[string]any{
			"anyTitleTypeIds": typeConstraint,
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

	variables := map[string]any{
		"first":       first,
		"constraints": constraints,
	}
	if params.After != "" {
		variables["after"] = params.After
	}

	query := fmt.Sprintf(`
	  query BrowseTitles($first: Int!, $constraints: AdvancedTitleSearchConstraints!, $after: String) {
	    advancedTitleSearch(first: $first, after: $after, constraints: $constraints) {
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
	title, err := FetchTitle(imdbID)
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
		case "tvSeries", "tvMiniSeries", "tvSpecial":
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
