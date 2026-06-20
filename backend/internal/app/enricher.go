package app

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/favorite"
	"github.com/bentran/nicefilm/backend/internal/title"
	"github.com/bentran/nicefilm/backend/internal/watching"
)

// titleEnricher satisfies title.Enricher by composing the per-user state title
// needs from the favorite and watching modules, so title imports neither.
type titleEnricher struct {
	favorites *favorite.Enricher
	watching  *watching.Enricher
}

func newTitleEnricher(db *sql.DB) titleEnricher {
	return titleEnricher{
		favorites: favorite.NewEnricher(db),
		watching:  watching.NewEnricher(db),
	}
}

func (e titleEnricher) FavoritedSet(userID int64) map[string]struct{} {
	return e.favorites.FavoritedSet(userID)
}

func (e titleEnricher) Progress(userID int64, imdbID string) []title.TitleProgress {
	return e.watching.Progress(userID, imdbID)
}

func (e titleEnricher) SubtitlePref(userID int64, imdbID string) *title.TitleSubtitle {
	return e.watching.SubtitlePref(userID, imdbID)
}
