package title

import (
	"errors"
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
	// IsFavorite is set by handlers (not IMDb) when the requesting user has
	// favorited this title, so cards can render the heart state server-side.
	IsFavorite bool `json:"isFavorite,omitempty"`
}

// hasImage reports whether the title has a usable primary poster — the exact
// field the UI cards render (toMovie: poster = primaryImage.url). Titles with
// only gallery images (common for podcasts) still render as blank cards, so we
// require the primary image specifically. Every listing filters on this
// (search, trending, browse, and — via browse — similar).
func (t ImdbTitle) hasImage() bool {
	return t.PrimaryImage != nil && t.PrimaryImage.URL != ""
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

// IMDb data is public, user-independent, and rarely changes — cache both single
// titles and list results so hot paths (home-page lists, the Continue Watching
// cards that embed detail per title) don't re-query IMDb for every render.
const titleCacheTTL = time.Hour
