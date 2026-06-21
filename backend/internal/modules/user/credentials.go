package user

import "database/sql"

// CredentialStore exposes a user's stored API keys to the modules that consume
// them (learning, subtitle) without exposing the full user repository. Reads
// only; the HTTP API owns writes.
type CredentialStore struct {
	repo Repository
}

func NewCredentialStore(db *sql.DB) *CredentialStore {
	return &CredentialStore{repo: NewRepository(db)}
}

// Get returns a user's stored credentials (zero value on error / none stored).
func (s *CredentialStore) Get(userID int64) Credentials {
	c, err := s.repo.GetCredentials(userID)
	if err != nil {
		return Credentials{}
	}
	return c
}
