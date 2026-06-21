package history

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/modules/favorite"
	"github.com/bentran/nicefilm/backend/internal/modules/title"
)

// Enricher implements title.Enricher: it supplies all the per-user state the
// title module folds into its responses — resume points + chosen subtitle (from
// this module) and the favorited-id set (delegated to the favorite module, which
// history already depends on). This keeps the composition out of app.go while
// leaving title importing neither module.
type Enricher struct {
	repo      Repository
	favorites *favorite.Enricher
}

func NewEnricher(db *sql.DB) *Enricher {
	return &Enricher{repo: NewRepository(db), favorites: favorite.NewEnricher(db)}
}

// FavoritedIds forwards to the favorite module so title enrichment can flag
// favorited titles in a list.
func (e *Enricher) FavoritedIds(userID int64) map[string]struct{} {
	return e.favorites.FavoritedIds(userID)
}

// IsFavorited forwards a single-title favorite check to the favorite module.
func (e *Enricher) IsFavorited(userID int64, imdbID string) bool {
	return e.favorites.IsFavorited(userID, imdbID)
}

func (e *Enricher) Progress(userID int64, imdbID string) []title.TitleProgress {
	rows, err := e.repo.GetTitleProgress(userID, imdbID)
	if err != nil {
		return nil
	}
	out := make([]title.TitleProgress, len(rows))
	for i, r := range rows {
		out[i] = title.TitleProgress{
			Season:          r.Season,
			Episode:         r.Episode,
			PositionSeconds: r.PositionSeconds,
			DurationSeconds: r.DurationSeconds,
			UpdatedAt:       r.UpdatedAt,
		}
		if r.SubFileID > 0 {
			out[i].SubtitlePref = &title.TitleSubtitle{FileID: r.SubFileID, Language: r.SubLanguage}
		}
	}
	return out
}
