package watching

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/title"
)

// Enricher exposes a user's per-title progress and subtitle preference for title
// enrichment, mapped into the title package's DTOs, without exposing the full
// Repository.
type Enricher struct {
	repo Repository
}

func NewEnricher(db *sql.DB) *Enricher {
	return &Enricher{repo: NewRepository(db)}
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
	}
	return out
}

func (e *Enricher) SubtitlePref(userID int64, imdbID string) *title.TitleSubtitle {
	sub, err := e.repo.GetTitleSubtitle(userID, imdbID)
	if err != nil || sub == nil {
		return nil
	}
	return &title.TitleSubtitle{FileID: sub.FileID, Language: sub.Language}
}
