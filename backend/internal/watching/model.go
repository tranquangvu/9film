package watching

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	UpdatedAt       string  `json:"updatedAt"`
}

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}
