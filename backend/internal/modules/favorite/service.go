package favorite

import (
	"sync"

	"github.com/bentran/nicefilm/backend/internal/modules/title"
)

// Bound concurrent IMDb lookups per request so a page doesn't fan out 50 calls.
const favoriteDetailConcurrency = 8

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

	hydrated := make([]favoriteItem, len(rows))
	sem := make(chan struct{}, favoriteDetailConcurrency)
	var wg sync.WaitGroup
	for i := range rows {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			hydrated[i].Favorite = rows[i]
			// userID 0: fetch raw title detail; it's a favorite by definition.
			if t, err := s.titles.GetTitle(0, rows[i].ImdbID); err == nil {
				t.IsFavorite = true
				hydrated[i].Title = t
			}
		}(i)
	}
	wg.Wait()

	// Drop rows whose title couldn't be resolved so the UI never shows blanks.
	items = make([]favoriteItem, 0, len(hydrated))
	for _, it := range hydrated {
		if it.Title == nil {
			continue
		}
		items = append(items, it)
	}

	return items, hasMore, offset + len(rows), nil
}

func (s *service) AddFavorite(userID int64, imdbID, mediaType string) error {
	return s.repo.AddFavorite(userID, imdbID, mediaType)
}

func (s *service) RemoveFavorite(userID int64, imdbID string) error {
	return s.repo.RemoveFavorite(userID, imdbID)
}
