package subtitle

type SubtitleSearchParams struct {
	IMDbID    string
	TMDbID    int
	MediaType string
	Season    *int
	Episode   *int
	Languages string
}

type SubtitleOption struct {
	FileID        int    `json:"fileId"`
	Language      string `json:"language"`
	Label         string `json:"label"`
	DownloadCount int    `json:"downloadCount"`
	Release       string `json:"release"`
}
