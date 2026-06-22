package favorite

import (
	"github.com/bentran/nicefilm/backend/internal/modules/title"
)

type Service interface {
	Favorites(userID int64, limit, offset int) (items []favoriteItem, hasMore bool, nextOffset int, err error)
	AddFavorite(userID int64, imdbID, mediaType string) error
	RemoveFavorite(userID int64, imdbID string) error
}

type service struct {
	repo   Repository
	titles title.Service
}

func NewService(repo Repository, titles title.Service) Service {
	return &service{repo: repo, titles: titles}
}

// Favorites returns a paginated page of the user's favorites with each title's
// detail hydrated (concurrently, bounded) and unresolved rows dropped. It fetches
// one extra row to detect whether another page exists. Every item is, by
// definition, a favorite, so each title is flagged IsFavorite.
func (s *service) Favorites(userID int64, limit, offset int) (items []favoriteItem, hasMore bool, nextOffset int, err error) {
	rows, err := s.repo.Favorites(userID, limit+1, offset)
	if err != nil {
		return nil, false, 0, err
	}
	hasMore = len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	// Hydrate every row's title detail in one batched request.
	ids := make([]string, len(rows))
	for i := range rows {
		ids[i] = rows[i].ImdbID
	}
	titlesByID, err := s.titles.GetTitles(0, ids)
	if err != nil {
		return nil, false, 0, err
	}

	// Keep the rows' order; drop those whose title couldn't be resolved so the UI
	// never shows blanks. Every item here is a favorite by definition.
	items = make([]favoriteItem, 0, len(rows))
	for _, row := range rows {
		t, ok := titlesByID[row.ImdbID]
		if !ok {
			continue
		}
		t.IsFavorite = true
		items = append(items, favoriteItem{Favorite: row, Title: t})
	}

	return items, hasMore, offset + len(rows), nil
}

func (s *service) AddFavorite(userID int64, imdbID, mediaType string) error {
	return s.repo.AddFavorite(userID, imdbID, mediaType)
}

func (s *service) RemoveFavorite(userID int64, imdbID string) error {
	return s.repo.RemoveFavorite(userID, imdbID)
}
