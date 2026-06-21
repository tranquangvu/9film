package history

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	// The subtitle chosen for this episode. SubFileID is 0 when none is set.
	SubFileID   int64  `json:"subFileId,omitempty"`
	SubLanguage string `json:"subLanguage,omitempty"`
	UpdatedAt   string `json:"updatedAt"`
}

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	Season   int    `json:"season"`
	Episode  int    `json:"episode"`
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}
