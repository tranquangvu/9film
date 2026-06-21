package user

import (
	"errors"
	"net/url"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
)

var (
	ErrUsernameTaken = errors.New("that username is already taken")
	// ErrUnknownUser is returned by Login when no account has the given username.
	// This app is local and password-less: a correct username is the only thing
	// needed to sign in.
	ErrUnknownUser = errors.New("unknown username")
)

// Service owns the user business logic: password-less auth (issuing JWTs via the
// middleware package) and settings-default filling.
type Service interface {
	Signup(username string) (*User, string, error)
	Login(username string) (*User, string, error)
	GetUser(id int64) (*User, error)
	GetSettings(userID int64) (Settings, error)
	SaveSettings(userID int64, st Settings) (Settings, error)
}

type service struct {
	repo Repository
	cfg  *config.Config
}

func NewService(repo Repository, cfg *config.Config) Service {
	return &service{repo: repo, cfg: cfg}
}

func avatarFor(username string) string {
	return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + url.QueryEscape(username)
}

func (s *service) Signup(username string) (*User, string, error) {
	if _, err := s.repo.GetUserByUsername(username); err == nil {
		return nil, "", ErrUsernameTaken
	} else if !errors.Is(err, ErrNotFound) {
		return nil, "", err
	}

	u, err := s.repo.CreateUser(username, avatarFor(username))
	if err != nil {
		return nil, "", err
	}
	token, err := middleware.Issue(u.ID, s.cfg.JWTSecret, s.cfg.TokenTTL)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

// Login looks up the account by username and returns the user plus a signed JWT.
// There is no password: a correct (existing) username is sufficient.
func (s *service) Login(username string) (*User, string, error) {
	u, err := s.repo.GetUserByUsername(username)
	if err != nil {
		return nil, "", ErrUnknownUser
	}
	token, err := middleware.Issue(u.ID, s.cfg.JWTSecret, s.cfg.TokenTTL)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

func (s *service) GetUser(id int64) (*User, error) {
	return s.repo.GetUserByID(id)
}

func (s *service) GetSettings(userID int64) (Settings, error) {
	return s.repo.GetSettings(userID)
}

// SaveSettings fills empty fields with defaults before persisting.
func (s *service) SaveSettings(userID int64, st Settings) (Settings, error) {
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

// normalizeUsername lower-cases and trims a username; an empty result is a
// user-facing validation error.
func normalizeUsername(raw string) (string, error) {
	username := strings.ToLower(strings.TrimSpace(raw))
	if username == "" {
		return "", errors.New("a username is required")
	}
	return username, nil
}
