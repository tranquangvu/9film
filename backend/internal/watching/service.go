package watching

import (
	"sync"

	"github.com/bentran/nicefilm/backend/internal/title"
)

// Bound concurrent IMDb lookups per request so a page doesn't fan out 50 calls.
const continueDetailConcurrency = 8

// Favorites supplies the user's favorited-id set so continue-watching items can
// be flagged. Implemented by favorite.Enricher.
type Favorites interface {
	FavoritedSet(userID int64) map[string]struct{}
}

// Service owns watch-progress writes and the continue-watching hydration
// (fetching title detail through the title service).
type Service interface {
	UpsertProgress(userID int64, p Progress) error
	UpsertSubtitle(userID int64, p Subtitle) error
	ContinueWatching(userID int64, limit, offset int) (items []continueWatchingItem, hasMore bool, nextOffset int, err error)
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

// ContinueWatching returns the paginated, deduped-per-title resume list with
// each title's detail hydrated (concurrently, bounded) and unresolved rows
// dropped. It fetches one extra row to detect whether another page exists.
func (s *service) ContinueWatching(userID int64, limit, offset int) (items []continueWatchingItem, hasMore bool, nextOffset int, err error) {
	rows, err := s.repo.ContinueWatching(userID, limit+1, offset)
	if err != nil {
		return nil, false, 0, err
	}
	hasMore = len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	// Hydrate each row's title detail concurrently (bounded).
	hydrated := make([]continueWatchingItem, len(rows))
	sem := make(chan struct{}, continueDetailConcurrency)
	var wg sync.WaitGroup
	for i := range rows {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			hydrated[i].Progress = rows[i]
			if t, err := s.titles.GetTitle(rows[i].ImdbID); err == nil {
				hydrated[i].Title = t
			}
		}(i)
	}
	wg.Wait()

	// Drop rows whose title couldn't be resolved so the UI never shows blanks,
	// and flag the ones the user has favorited.
	fav := s.favorites.FavoritedSet(userID)
	items = make([]continueWatchingItem, 0, len(hydrated))
	for _, it := range hydrated {
		if it.Title == nil {
			continue
		}
		if _, ok := fav[it.Title.ID]; ok {
			it.Title.IsFavorite = true
		}
		items = append(items, it)
	}

	return items, hasMore, offset + len(rows), nil
}
