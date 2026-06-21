package history

import "github.com/bentran/nicefilm/backend/internal/modules/title"

// continueWatchingItem is a resume point with its IMDb title detail embedded, so
// the client can render the Continue Watching list without a per-title lookup.
type continueWatchingItem struct {
	Progress
	Title *title.Title `json:"title,omitempty"`
}
