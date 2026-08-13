package user

import (
	"net/url"
	"strings"
)

// Service owns the user business logic: the local account's profile, its
// settings (with defaults filled in), and the API keys for the optional
// integrations. There is no sign-in — see middleware.LocalUser.
type Service interface {
	GetUser(id int64) (*User, error)
	UpdateAvatar(id int64, avatar string) (*User, error)
	GetSettings(userID int64) (Settings, error)
	SaveSettings(userID int64, st Settings) (Settings, error)
	CredentialStatus(userID int64) (CredentialStatus, error)
	SaveCredentials(userID int64, patch Credentials) (CredentialStatus, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func avatarFor(username string) string {
	return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + url.QueryEscape(username)
}

func (s *service) GetUser(id int64) (*User, error) {
	return s.repo.GetUserByID(id)
}

// UpdateAvatar changes the account's picture. The username is not editable: it
// is how LocalUserID finds this account, and database.Migrate re-seeds the
// original name on every boot — so renaming it would strand every favorite,
// resume point and saved word on the old row and start the app in an empty one.
func (s *service) UpdateAvatar(id int64, avatar string) (*User, error) {
	avatar = strings.TrimSpace(avatar)
	if avatar == "" {
		avatar = avatarFor(localUsername)
	}
	return s.repo.UpdateAvatar(id, avatar)
}

func (s *service) GetSettings(userID int64) (Settings, error) {
	return s.repo.GetSettings(userID)
}

// SaveSettings fills empty fields with defaults before persisting.
func (s *service) SaveSettings(userID int64, st Settings) (Settings, error) {
	if st.DefaultSubtitleLang == "" {
		st.DefaultSubtitleLang = "en"
	}
	if st.LearningLang == "" {
		st.LearningLang = "vi"
	}
	if err := s.repo.UpsertSettings(userID, st); err != nil {
		return Settings{}, err
	}
	return st, nil
}

func (s *service) CredentialStatus(userID int64) (CredentialStatus, error) {
	c, err := s.repo.GetCredentials(userID)
	if err != nil {
		return CredentialStatus{}, err
	}
	return s.statusOf(c), nil
}

// SaveCredentials merges only the non-empty fields over the user's existing
// credentials (so a blank field keeps the current value), then returns status.
func (s *service) SaveCredentials(userID int64, patch Credentials) (CredentialStatus, error) {
	cur, err := s.repo.GetCredentials(userID)
	if err != nil {
		return CredentialStatus{}, err
	}
	if patch.GeminiAPIKey != "" {
		cur.GeminiAPIKey = patch.GeminiAPIKey
	}
	if patch.SubDLAPIKey != "" {
		cur.SubDLAPIKey = patch.SubDLAPIKey
	}
	if err := s.repo.SetCredentials(userID, cur); err != nil {
		return CredentialStatus{}, err
	}
	return s.statusOf(cur), nil
}

// statusOf reports which integrations are usable. Both keys are per-user and
// stored in the database — the server holds no fallback of its own, so a key
// that isn't set means that integration is simply off.
func (s *service) statusOf(c Credentials) CredentialStatus {
	return CredentialStatus{
		GeminiKeySet:   c.GeminiAPIKey != "",
		SubDLAPIKeySet: c.SubDLAPIKey != "",
	}
}
