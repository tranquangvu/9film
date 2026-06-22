package history

import (
	"github.com/bentran/nicefilm/backend/internal/modules/title"
)

// Favorites supplies the user's favorited-id set so continue-watching items can
// be flagged. Implemented by favorite.Enricher.
type Favorites interface {
	FavoritedIds(userID int64) map[string]struct{}
}

// Service owns watch-progress writes and the continue-watching hydration
// (fetching title detail through the title service).
type Service interface {
	UpsertProgress(userID int64, p Progress) error
	UpsertSubtitle(userID int64, p Subtitle) error
	GetHistory(userID int64, limit, offset int) (items []continueWatchingItem, hasMore bool, nextOffset int, err error)
}

type service struct {
	repo      Repository
	titles    title.Service
	favorites Favorites
}

func NewService(repo Repository, titles title.Service, favorites Favorites) Service {
	return &service{repo: repo, titles: titles, favorites: favorites}
}

func (s *service) UpsertProgress(userID int64, p Progress) error {
	return s.repo.UpsertProgress(userID, p)
}

func (s *service) UpsertSubtitle(userID int64, p Subtitle) error {
	return s.repo.UpsertSubtitle(userID, p)
}

// GetHistory returns the paginated, deduped-per-title resume list with
// each title's detail hydrated (concurrently, bounded) and unresolved rows
// dropped. It fetches one extra row to detect whether another page exists.
func (s *service) GetHistory(userID int64, limit, offset int) (items []continueWatchingItem, hasMore bool, nextOffset int, err error) {
	rows, err := s.repo.GetHistory(userID, limit+1, offset)
	if err != nil {
		return nil, false, 0, err
	}
	hasMore = len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	// Hydrate every row's title detail in one batched request (userID 0: raw
	// detail; favorites are flagged in batch below).
	ids := make([]string, len(rows))
	for i := range rows {
		ids[i] = rows[i].ImdbID
	}
	titlesByID, err := s.titles.GetTitles(0, ids)
	if err != nil {
		return nil, false, 0, err
	}

	// Keep the rows' order; drop those whose title couldn't be resolved so the UI
	// never shows blanks, and flag the ones the user has favorited.
	fav := s.favorites.FavoritedIds(userID)
	items = make([]continueWatchingItem, 0, len(rows))
	for _, row := range rows {
		t, ok := titlesByID[row.ImdbID]
		if !ok {
			continue
		}
		if _, ok := fav[t.ID]; ok {
			t.IsFavorite = true
		}
		items = append(items, continueWatchingItem{Progress: row, Title: t})
	}

	return items, hasMore, offset + len(rows), nil
}
