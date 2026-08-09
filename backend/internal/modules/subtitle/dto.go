package subtitle

type SubtitleSearchParams struct {
	IMDbID    string
	TMDbID    int
	MediaType string
	Season    *int
	Episode   *int
	Languages string
}

// SubtitleOption is one pickable subtitle track, normalized across providers.
type SubtitleOption struct {
	// ID is the opaque "<provider>:<ref>" handle. The frontend stores it and hands
	// it back to /api/subtitle/download; only the owning provider reads the ref.
	ID       string `json:"id"`
	Language string `json:"language"`
	Label    string `json:"label"`
	// DownloadCount is 0 for providers that don't publish one (SubDL). Options are
	// returned in the provider's own relevance order, and the frontend's sort by
	// this field is stable, so that order survives when every count is 0.
	DownloadCount int    `json:"downloadCount"`
	Release       string `json:"release"`
}
