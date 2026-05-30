package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const imdbGraphQLURL = "https://api.graphql.imdb.com/"

const titleDetailsQuery = `
  query TitleDetails($id: ID!) {
    title(id: $id) {
      id
      titleText { text }
      originalTitleText { text }
      titleType { id text canHaveEpisodes }
      releaseYear { year endYear }
      primaryImage { url width height }
      plot { plotText { plainText } }
      ratingsSummary { aggregateRating voteCount }
      runtime { seconds }
      genres { genres { text } }
      countriesOfOrigin { countries { text } }
      spokenLanguages { spokenLanguages { id text } }
    }
  }
`

type ImdbTitle struct {
	ID                string            `json:"id,omitempty"`
	TitleText         *TextNode         `json:"titleText,omitempty"`
	OriginalTitleText *TextNode         `json:"originalTitleText,omitempty"`
	TitleType         *TitleType        `json:"titleType,omitempty"`
	ReleaseYear       *ReleaseYear      `json:"releaseYear,omitempty"`
	PrimaryImage      *Image            `json:"primaryImage,omitempty"`
	Plot              *PlotNode         `json:"plot,omitempty"`
	RatingsSummary    *RatingsSummary   `json:"ratingsSummary,omitempty"`
	Runtime           *Runtime          `json:"runtime,omitempty"`
	Genres            *GenresWrapper    `json:"genres,omitempty"`
	SpokenLanguages   *LanguageWrapper  `json:"spokenLanguages,omitempty"`
}

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

type graphqlRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

type graphqlResponse struct {
	Data   *struct{ Title *ImdbTitle } `json:"data"`
	Errors []struct{ Message string }  `json:"errors"`
}

func normalizeImdbID(id string) string {
	if strings.HasPrefix(id, "tt") {
		return id
	}
	return "tt" + id
}

func FetchTitle(imdbID string) (*ImdbTitle, error) {
	id := normalizeImdbID(imdbID)

	payload, _ := json.Marshal(graphqlRequest{
		Query:     titleDetailsQuery,
		Variables: map[string]any{"id": id},
	})

	req, err := http.NewRequest(http.MethodPost, imdbGraphQLURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NiceFilm/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("IMDb GraphQL request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IMDb GraphQL failed (%d)", resp.StatusCode)
	}

	var gql graphqlResponse
	if err := json.NewDecoder(resp.Body).Decode(&gql); err != nil {
		return nil, fmt.Errorf("decode IMDb response: %w", err)
	}

	if len(gql.Errors) > 0 {
		return nil, fmt.Errorf("IMDb GraphQL error: %s", gql.Errors[0].Message)
	}

	title := gql.Data.Title
	if title == nil || title.ID == "" {
		return nil, fmt.Errorf("title not found on IMDb: %s", id)
	}

	return title, nil
}
