package title

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
	// season/episode 0; series: one per watched episode), each carrying the
	// subtitle chosen for that episode. Set by handlers from the store;
	// empty/absent for anonymous requests. Replaces the old /progress call.
	Progress []TitleProgress `json:"progress,omitempty"`
}

// TitleProgress is one episode's resume point (plus the subtitle chosen for it)
// embedded in a title's detail response.
type TitleProgress struct {
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	// The subtitle the user picked for this episode (absent when none is set).
	SubtitlePref *TitleSubtitle `json:"subtitlePref,omitempty"`
	UpdatedAt    string         `json:"updatedAt,omitempty"`
}

// TitleSubtitle is a saved subtitle selection embedded in a progress entry.
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

type BrowseResult struct {
	Titles      []Title `json:"titles"`
	HasNextPage bool    `json:"hasNextPage"`
	EndCursor   string  `json:"endCursor,omitempty"`
}
