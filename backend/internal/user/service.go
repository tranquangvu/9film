package user

import (
	"errors"
	"net/url"
	"strings"
	"sync"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/shared/auth"
	"github.com/bentran/nicefilm/backend/internal/title"
)

// Bound concurrent IMDb lookups per request so a page doesn't fan out 50 calls.
const continueDetailConcurrency = 8

var (
	// ErrEmailTaken is returned by Signup when the email already has an account.
	ErrEmailTaken = errors.New("an account with that email already exists")
	// ErrInvalidCredentials is returned by Login for an unknown email or a bad
	// password (the same error for both, so callers can't probe for valid emails).
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// Service owns the user business logic: auth (issuing JWTs via shared/auth),
// settings-default filling, and continue-watching hydration (fetching title
// detail through the title service).
type Service struct {
	repo   *Repository
	cfg    *config.Config
	titles *title.Service
}

func NewService(repo *Repository, cfg *config.Config, titles *title.Service) *Service {
	return &Service{repo: repo, cfg: cfg, titles: titles}
}

func avatarFor(email string) string {
	return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + url.QueryEscape(email)
}

// Signup creates a new account and returns the user plus a signed JWT.
func (s *Service) Signup(email, password, name string) (*User, string, error) {
	if _, err := s.repo.GetUserByEmail(email); err == nil {
		return nil, "", ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return nil, "", err
	}

	hash, err := auth.Hash(password)
	if err != nil {
		return nil, "", err
	}

	u, err := s.repo.CreateUser(email, hash, name, avatarFor(email))
	if err != nil {
		return nil, "", err
	}
	token, err := auth.Issue(u.ID, s.cfg.JWTSecret, s.cfg.TokenTTL)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

// Login verifies credentials and returns the user plus a signed JWT.
func (s *Service) Login(email, password string) (*User, string, error) {
	u, err := s.repo.GetUserByEmail(email)
	if err != nil || !auth.Verify(u.PasswordHash, password) {
		return nil, "", ErrInvalidCredentials
	}
	token, err := auth.Issue(u.ID, s.cfg.JWTSecret, s.cfg.TokenTTL)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

func (s *Service) GetUser(id int64) (*User, error) {
	return s.repo.GetUserByID(id)
}

func (s *Service) GetSettings(userID int64) (Settings, error) {
	return s.repo.GetSettings(userID)
}

// SaveSettings fills empty fields with defaults before persisting.
func (s *Service) SaveSettings(userID int64, st Settings) (Settings, error) {
	if st.DefaultSubtitleLang == "" {
		st.DefaultSubtitleLang = "en"
	}
	if st.DefaultQuality == "" {
		st.DefaultQuality = "auto"
	}
	if st.LearningLang == "" {
		st.LearningLang = "vi"
	}
	if err := s.repo.UpsertSettings(userID, st); err != nil {
		return Settings{}, err
	}
	return st, nil
}

func (s *Service) Favorites(userID int64) ([]Favorite, error) {
	return s.repo.Favorites(userID)
}

func (s *Service) AddFavorite(userID int64, imdbID, mediaType string) error {
	return s.repo.AddFavorite(userID, imdbID, mediaType)
}

func (s *Service) RemoveFavorite(userID int64, imdbID string) error {
	return s.repo.RemoveFavorite(userID, imdbID)
}

func (s *Service) UpsertProgress(userID int64, p Progress) error {
	return s.repo.UpsertProgress(userID, p)
}

func (s *Service) UpsertSubtitle(userID int64, p Subtitle) error {
	return s.repo.UpsertSubtitle(userID, p)
}

// ContinueWatching returns the paginated, deduped-per-title resume list with
// each title's detail hydrated (concurrently, bounded) and unresolved rows
// dropped. It fetches one extra row to detect whether another page exists.
func (s *Service) ContinueWatching(userID int64, limit, offset int) (items []continueWatchingItem, hasMore bool, nextOffset int, err error) {
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
	fav, _ := s.repo.FavoritedSet(userID)
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

// normalizeSignup validates and normalizes signup input, returning the cleaned
// email/name or a user-facing validation error.
func normalizeSignup(req signupRequest) (email, name string, err error) {
	email = strings.ToLower(strings.TrimSpace(req.Email))
	name = strings.TrimSpace(req.Name)
	if email == "" || !strings.Contains(email, "@") {
		return "", "", errors.New("a valid email is required")
	}
	if len(req.Password) < 6 {
		return "", "", errors.New("password must be at least 6 characters")
	}
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	return email, name, nil
}
