package history

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	// The subtitle chosen for this episode: an opaque "<provider>:<ref>" id, empty
	// when none is set.
	SubRef      string `json:"subRef,omitempty"`
	SubLanguage string `json:"subLanguage,omitempty"`
	UpdatedAt   string `json:"updatedAt"`
}

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	Season   int    `json:"season"`
	Episode  int    `json:"episode"`
	ID       string `json:"id"`
	Language string `json:"language"`
}
