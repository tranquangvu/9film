package title

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Enricher supplies the per-user state folded into title responses for signed-in
// requests: the favorited-id set (for lists), a single-title favorite check (for
// detail), and resume points + chosen subtitle. The title package owns this
// interface and never imports the modules that implement it, keeping the
// dependency direction one-way; app.go injects history.NewEnricher.
type Enricher interface {
	FavoritedIds(userID int64) map[string]struct{}
	IsFavorited(userID int64, imdbID string) bool
	Progress(userID int64, imdbID string) []TitleProgress
}

// NoEnrichment is an Enricher that adds nothing — for callers that want raw
// title data and fold in their own per-user state (e.g. the history module
// hydrating Continue-Watching cards).
var NoEnrichment Enricher = noopEnricher{}

type noopEnricher struct{}

func (noopEnricher) FavoritedIds(int64) map[string]struct{} { return nil }
func (noopEnricher) IsFavorited(int64, string) bool         { return false }
func (noopEnricher) Progress(int64, string) []TitleProgress { return nil }

// Service flattens the raw IMDb data the Repository returns into the client-ready
// Title DTO and folds in the requesting user's state via the Enricher. Every
// public method takes the user id (0 = anonymous, no enrichment) so handlers
// stay thin.
type Service interface {
	GetTitle(userID int64, imdbID string) (*Title, error)
	GetTitles(userID int64, imdbIDs []string) (map[string]*Title, error)
	SearchTitles(userID int64, term string, limit int) ([]Title, error)
	TrendingTitles(userID int64, limit int) ([]Title, error)
	BrowseTitles(userID int64, params BrowseParams) (*BrowseResult, error)
	SimilarTitles(userID int64, imdbID string, limit int) ([]Title, error)
}

type service struct {
	repo     Repository
	enricher Enricher
}

func NewService(repo Repository, enricher Enricher) Service {
	return &service{repo: repo, enricher: enricher}
}

// GetTitle returns the flattened, client-ready detail for an IMDb id, with the
// user's favorite flag and resume points folded in.
func (s *service) GetTitle(userID int64, imdbID string) (*Title, error) {
	raw, err := s.repo.FetchTitle(imdbID)
	if err != nil {
		return nil, err
	}
	out := toTitle(*raw)
	s.enrichDetail(userID, &out)
	return &out, nil
}

// GetTitles flattens many titles at once (one batched IMDb request for the cache
// misses), keyed by IMDb id, folding in the user's favorite flag and resume
// points. Callers that do their own per-user flagging pass userID 0.
func (s *service) GetTitles(userID int64, imdbIDs []string) (map[string]*Title, error) {
	raws, err := s.repo.FetchTitles(imdbIDs)
	if err != nil {
		return nil, err
	}
	out := make(map[string]*Title, len(raws))
	var set map[string]struct{}
	if userID != 0 {
		set = s.enricher.FavoritedIds(userID)
	}
	for id, raw := range raws {
		t := toTitle(*raw)
		if userID != 0 {
			if _, ok := set[t.ID]; ok {
				t.IsFavorite = true
			}
			if rows := s.enricher.Progress(userID, t.ID); rows != nil {
				t.Progress = rows
			}
		}
		out[id] = &t
	}
	return out, nil
}

func (s *service) SearchTitles(userID int64, term string, limit int) ([]Title, error) {
	raw, err := s.repo.SearchTitles(term, limit)
	if err != nil {
		return nil, err
	}
	out := make([]Title, 0, len(raw))
	for _, t := range raw {
		out = append(out, toTitle(t))
	}
	s.markFavorites(userID, out)
	return out, nil
}

func (s *service) TrendingTitles(userID int64, limit int) ([]Title, error) {
	raw, err := s.repo.TrendingTitles(limit)
	if err != nil {
		return nil, err
	}
	out := make([]Title, 0, len(raw))
	for _, t := range raw {
		out = append(out, toTitle(t))
	}
	s.markFavorites(userID, out)
	return out, nil
}

func (s *service) BrowseTitles(userID int64, params BrowseParams) (*BrowseResult, error) {
	result, err := s.browse(params)
	if err != nil {
		return nil, err
	}
	s.markFavorites(userID, result.Titles)
	return result, nil
}

// browse fetches and flattens a browse page without per-user enrichment, so it
// can back both BrowseTitles and SimilarTitles (which enrich at their own end).
func (s *service) browse(params BrowseParams) (*BrowseResult, error) {
	raw, err := s.repo.BrowseTitles(params)
	if err != nil {
		return nil, err
	}
	result := &BrowseResult{
		HasNextPage: raw.HasNextPage,
		EndCursor:   raw.EndCursor,
	}
	for _, t := range raw.Titles {
		result.Titles = append(result.Titles, toTitle(t))
	}
	return result, nil
}

func (s *service) SimilarTitles(userID int64, imdbID string, limit int) ([]Title, error) {
	title, err := s.repo.FetchTitle(imdbID)
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

	result, err := s.browse(BrowseParams{
		Type:  mediaType,
		Genre: genre,
		First: limit + 5,
	})
	if err != nil {
		return nil, err
	}

	filtered := make([]Title, 0, limit)
	for _, item := range result.Titles {
		if item.ID == title.ID {
			continue
		}
		filtered = append(filtered, item)
		if len(filtered) >= limit {
			break
		}
	}
	s.markFavorites(userID, filtered)
	return filtered, nil
}

// markFavorites flags the titles the user has favorited, using a single
// favorited-id set lookup for the whole slice. No-op for anonymous requests.
func (s *service) markFavorites(userID int64, titles []Title) {
	if userID == 0 {
		return
	}
	set := s.enricher.FavoritedIds(userID)
	if set == nil {
		return
	}
	for i := range titles {
		if _, ok := set[titles[i].ID]; ok {
			titles[i].IsFavorite = true
		}
	}
}

// enrichDetail folds the user's favorite flag and per-episode resume points into
// a single title's detail. No-op for anonymous requests.
func (s *service) enrichDetail(userID int64, t *Title) {
	if userID == 0 {
		return
	}
	t.IsFavorite = s.enricher.IsFavorited(userID, t.ID)
	if rows := s.enricher.Progress(userID, t.ID); rows != nil {
		t.Progress = rows
	}
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
