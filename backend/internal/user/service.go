package user

import (
	"errors"
	"net/url"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/middleware"
)

var (
	// ErrEmailTaken is returned by Signup when the email already has an account.
	ErrEmailTaken = errors.New("an account with that email already exists")
	// ErrInvalidCredentials is returned by Login for an unknown email or a bad
	// password (the same error for both, so callers can't probe for valid emails).
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// Service owns the user business logic: auth (hashing passwords + issuing JWTs
// via the middleware package) and settings-default filling.
type Service interface {
	Signup(email, password, name string) (*User, string, error)
	Login(email, password string) (*User, string, error)
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

func avatarFor(email string) string {
	return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + url.QueryEscape(email)
}

// Signup creates a new account and returns the user plus a signed JWT.
func (s *service) Signup(email, password, name string) (*User, string, error) {
	if _, err := s.repo.GetUserByEmail(email); err == nil {
		return nil, "", ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return nil, "", err
	}

	hash, err := middleware.Hash(password)
	if err != nil {
		return nil, "", err
	}

	u, err := s.repo.CreateUser(email, hash, name, avatarFor(email))
	if err != nil {
		return nil, "", err
	}
	token, err := middleware.Issue(u.ID, s.cfg.JWTSecret, s.cfg.TokenTTL)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

// Login verifies credentials and returns the user plus a signed JWT.
func (s *service) Login(email, password string) (*User, string, error) {
	u, err := s.repo.GetUserByEmail(email)
	if err != nil || !middleware.Verify(u.PasswordHash, password) {
		return nil, "", ErrInvalidCredentials
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
