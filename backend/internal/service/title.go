package service

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Title is the flattened, client-ready shape of an IMDb title. The raw GraphQL
// response (ImdbTitle) is deeply nested; every handler returns this instead so
// the frontend can consume titles directly without re-flattening. Field names
// mirror the web `Movie` type.
type Title struct {
	ID            string       `json:"id"`
	Title         string       `json:"title"`
	OriginalTitle string       `json:"originalTitle,omitempty"`
	Description   string       `json:"description"`
	Poster        string       `json:"poster"`
	Backdrop      string       `json:"backdrop"`
	Rating        float64      `json:"rating"`
	VoteCount     int          `json:"voteCount,omitempty"`
	Year          string       `json:"year"`
	EndYear       string       `json:"endYear,omitempty"`
	ReleaseDate   string       `json:"releaseDate,omitempty"`
	Duration      int          `json:"duration"` // minutes
	Genres        []string     `json:"genres"`
	Cast          []CastMember `json:"cast,omitempty"`
	Director      string       `json:"director,omitempty"`
	Language      string       `json:"language,omitempty"`
	LanguageCode  string       `json:"languageCode,omitempty"`
	Country       string       `json:"country,omitempty"`
	Type          string       `json:"type"` // "movie" | "series"
	TotalSeasons  int          `json:"totalSeasons,omitempty"`
	TotalEpisodes int          `json:"totalEpisodes,omitempty"`
	// Gallery images with dimensions — kept so the client can still rank hero
	// backdrops by resolution. Backdrop above is the pre-picked best landscape.
	Images []TitleImage `json:"images,omitempty"`
	// Set by handlers (not IMDb) when the requesting user has favorited the title.
	IsFavorite bool `json:"isFavorite,omitempty"`
	// The requesting user's resume points for this title (movies: one row with
	// season/episode 0; series: one per watched episode). Set by handlers from the
	// store; empty/absent for anonymous requests. Replaces the old /progress call.
	Progress []TitleProgress `json:"progress,omitempty"`
	// The requesting user's saved subtitle selection for this title (absent when
	// anonymous or unset). Set by handlers; replaces the old /subtitles call.
	SubtitlePref *TitleSubtitle `json:"subtitlePref,omitempty"`
}

// TitleProgress is one resume point embedded in a title's detail response.
type TitleProgress struct {
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	UpdatedAt       string  `json:"updatedAt,omitempty"`
}

// TitleSubtitle is the user's saved subtitle selection embedded in a title's
// detail response.
type TitleSubtitle struct {
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}

type CastMember struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Character string `json:"character,omitempty"`
	Photo     string `json:"photo,omitempty"`
}

type TitleImage struct {
	URL    string `json:"url"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

// IMDb title-type ids that the client treats as episodic "series".
var tvTitleTypes = map[string]bool{
	"tvSeries": true, "tvMiniSeries": true, "tvSpecial": true, "tvMovie": true,
}

// IMDb 2-letter language ids that don't map cleanly to a BCP-47 prefix.
var langCodeMap = map[string]string{
	"cn": "zh-cn", "tw": "zh-tw", "pb": "pt-br", "pt": "pt-pt",
}

// toTitle flattens a raw IMDb title into the client-ready DTO. Every field is
// nil-guarded so it works for both card (titleCardFields) and detail payloads.
func toTitle(t ImdbTitle) Title {
	poster := ""
	if t.PrimaryImage != nil {
		poster = t.PrimaryImage.URL
	}

	backdrop := pickBackdrop(t)
	if backdrop == "" {
		backdrop = poster
	}

	var rating float64
	var voteCount int
	if t.RatingsSummary != nil {
		if t.RatingsSummary.AggregateRating != nil {
			rating = *t.RatingsSummary.AggregateRating
		}
		if t.RatingsSummary.VoteCount != nil {
			voteCount = *t.RatingsSummary.VoteCount
		}
	}

	duration := 0
	if t.Runtime != nil && t.Runtime.Seconds != nil {
		duration = int(math.Round(float64(*t.Runtime.Seconds) / 60))
	}

	genres := []string{}
	if t.Genres != nil {
		for _, g := range t.Genres.Genres {
			if g.Text != "" {
				genres = append(genres, g.Text)
			}
		}
	}

	description := ""
	if t.Plot != nil && t.Plot.PlotText != nil {
		description = t.Plot.PlotText.PlainText
	}

	country := ""
	if t.CountriesOfOrigin != nil && len(t.CountriesOfOrigin.Countries) > 0 {
		country = t.CountriesOfOrigin.Countries[0].Text
	}

	language, languageCode := pickLanguage(t)

	out := Title{
		ID:            t.ID,
		Title:         textOf(t.TitleText),
		OriginalTitle: textOf(t.OriginalTitleText),
		Description:   description,
		Poster:        poster,
		Backdrop:      backdrop,
		Rating:        rating,
		VoteCount:     voteCount,
		Year:          yearStr(t.ReleaseYear),
		ReleaseDate:   releaseDateStr(t.ReleaseDate),
		Duration:      duration,
		Genres:        genres,
		Cast:          mapCast(t),
		Director:      pickDirector(t),
		Language:      language,
		LanguageCode:  languageCode,
		Country:       country,
		Type:          pickType(t),
		Images:        mapImages(t),
		IsFavorite:    t.IsFavorite,
	}
	if t.ReleaseYear != nil && t.ReleaseYear.EndYear != nil {
		out.EndYear = strconv.Itoa(*t.ReleaseYear.EndYear)
	}
	if out.Type == "series" && t.Episodes != nil {
		out.TotalSeasons = len(t.Episodes.Seasons)
		if t.Episodes.Episodes != nil {
			out.TotalEpisodes = t.Episodes.Episodes.Total
		}
	}
	return out
}

// toTitles flattens and ID-filters a slice of raw titles.
func toTitles(raw []ImdbTitle) []Title {
	out := make([]Title, 0, len(raw))
	for _, t := range raw {
		if t.ID != "" {
			out = append(out, toTitle(t))
		}
	}
	return out
}

func pickType(t ImdbTitle) string {
	if t.TitleType != nil && tvTitleTypes[t.TitleType.ID] {
		return "series"
	}
	return "movie"
}

// pickBackdrop returns the largest landscape gallery image (what the hero banner
// wants); falls back to the first image, then empty so the caller can use poster.
func pickBackdrop(t ImdbTitle) string {
	if t.Images == nil {
		return ""
	}
	var best *Image
	firstURL := ""
	for i := range t.Images.Edges {
		n := t.Images.Edges[i].Node
		if n.URL == "" {
			continue
		}
		if firstURL == "" {
			firstURL = n.URL
		}
		if n.Width <= n.Height { // landscape only
			continue
		}
		if best == nil || n.Width*n.Height > best.Width*best.Height {
			node := n
			best = &node
		}
	}
	if best != nil {
		return best.URL
	}
	return firstURL
}

func mapImages(t ImdbTitle) []TitleImage {
	if t.Images == nil {
		return nil
	}
	out := make([]TitleImage, 0, len(t.Images.Edges))
	for i := range t.Images.Edges {
		n := t.Images.Edges[i].Node
		if n.URL == "" {
			continue
		}
		out = append(out, TitleImage{URL: n.URL, Width: n.Width, Height: n.Height})
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func mapCast(t ImdbTitle) []CastMember {
	var stars *PrincipalCreditGroup
	for i := range t.PrincipalCredits {
		if g := &t.PrincipalCredits[i]; g.Category != nil && g.Category.Text == "Stars" {
			stars = g
			break
		}
	}
	if stars == nil {
		return nil
	}
	out := make([]CastMember, 0, len(stars.Credits))
	for _, c := range stars.Credits {
		var m CastMember
		if c.Name != nil {
			m.ID = c.Name.ID
			if c.Name.NameText != nil {
				m.Name = c.Name.NameText.Text
			}
			if m.ID == "" {
				m.ID = m.Name
			}
			if c.Name.PrimaryImage != nil {
				m.Photo = c.Name.PrimaryImage.URL
			}
		}
		if len(c.Characters) > 0 {
			m.Character = c.Characters[0].Name
		}
		out = append(out, m)
	}
	return out
}

func pickDirector(t ImdbTitle) string {
	for i := range t.PrincipalCredits {
		g := t.PrincipalCredits[i]
		if g.Category != nil && g.Category.Text == "Director" && len(g.Credits) > 0 {
			if n := g.Credits[0].Name; n != nil && n.NameText != nil {
				return n.NameText.Text
			}
		}
	}
	return ""
}

// pickLanguage returns the primary spoken language's label and a normalized code
// (e.g. "en"), mirroring the client's origLang mapping used by the stream flow.
func pickLanguage(t ImdbTitle) (label, code string) {
	if t.SpokenLanguages == nil || len(t.SpokenLanguages.SpokenLanguages) == 0 {
		return "", ""
	}
	p := t.SpokenLanguages.SpokenLanguages[0]
	label = p.Text
	raw := strings.ToLower(strings.TrimSpace(p.ID))
	if raw == "" {
		return label, ""
	}
	if mapped, ok := langCodeMap[raw]; ok {
		return label, mapped
	}
	return label, strings.SplitN(raw, "-", 2)[0]
}

func textOf(n *TextNode) string {
	if n != nil {
		return n.Text
	}
	return ""
}

func yearStr(r *ReleaseYear) string {
	if r != nil && r.Year != nil {
		return strconv.Itoa(*r.Year)
	}
	return ""
}

func releaseDateStr(d *ReleaseDate) string {
	if d == nil || d.Year == nil {
		return ""
	}
	month, day := 1, 1
	if d.Month != nil {
		month = *d.Month
	}
	if d.Day != nil {
		day = *d.Day
	}
	return fmt.Sprintf("%04d-%02d-%02d", *d.Year, month, day)
}
