package favorite

import (
	"database/sql"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

// Enricher exposes the user's favorited-id set for title enrichment and for
// flagging continue-watching items, without exposing the full Repository.
type Enricher struct {
	repo Repository
}

func NewEnricher(db *sql.DB) *Enricher {
	return &Enricher{repo: NewRepository(db)}
}

func (e *Enricher) FavoritedSet(userID int64) map[string]struct{} {
	set, err := e.repo.FavoritedSet(userID)
	if err != nil {
		logger.Get().Warn("favorited set lookup failed", zap.Error(err))
		return nil
	}
	return set
}
