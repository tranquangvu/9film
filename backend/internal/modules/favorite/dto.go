package favorite

import "github.com/bentran/nicefilm/backend/internal/modules/title"

type addFavoriteRequest struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
}

// favoriteItem is a favorite row with its IMDb title detail embedded, so the
// client renders the My List grid without a per-title lookup (mirrors the
// continue-watching hydration).
type favoriteItem struct {
	Favorite
	Title *title.Title `json:"title,omitempty"`
}
