package favorite

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

// Enricher exposes the user's favorite state for title enrichment and for
// flagging continue-watching items, without exposing the full Repository: the
// favorited-id set for lists, and a single-title check for the detail page.
type Enricher struct {
	repo Repository
}

func NewEnricher(db *sql.DB) *Enricher {
	return &Enricher{repo: NewRepository(db)}
}

func (e *Enricher) FavoritedIds(userID int64) map[string]struct{} {
	set, err := e.repo.FavoritedIds(userID)
	if err != nil {
		logger.Get().Warn("favorited set lookup failed", zap.Error(err))
		return nil
	}
	return set
}

func (e *Enricher) IsFavorited(userID int64, imdbID string) bool {
	ok, err := e.repo.IsFavorited(userID, imdbID)
	if err != nil {
		logger.Get().Warn("is-favorited lookup failed", zap.Error(err))
		return false
	}
	return ok
}
