package user

import "github.com/bentran/nicefilm/backend/internal/title"

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type addFavoriteRequest struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
}

// continueWatchingItem is a resume point with its IMDb title detail embedded, so
// the client can render the Continue Watching list without a per-title lookup.
type continueWatchingItem struct {
	Progress
	Title *title.Title `json:"title,omitempty"`
}
