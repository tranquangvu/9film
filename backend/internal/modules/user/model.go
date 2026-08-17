package user

import "errors"

var ErrNotFound = errors.New("not found")

type User struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Avatar    string `json:"avatar"`
	CreatedAt string `json:"createdAt"`
}

type Settings struct {
	AutoplayNext        bool   `json:"autoplayNext"`
	DefaultSubtitleLang string `json:"defaultSubtitleLang"`
	LearningMode        bool   `json:"learningMode"`
	LearningLang        string `json:"learningLang"`
}

// Credentials are a user's own API keys for the optional integrations.
type Credentials struct {
	GeminiAPIKey string
	SubDLAPIKey  string
}

// CredentialStatus is the secret-free view sent to the client: whether each key
// is set, and its last few characters so the form can show *which* key is
// stored. A key that isn't set means that integration is off, so this doubles as
// the signal the UI uses to offer adding one. The stored key itself is never
// echoed back — the hints are the only part that ever leaves the server, and
// keyHint decides how little that is.
type CredentialStatus struct {
	GeminiKeySet    bool   `json:"geminiKeySet"`
	GeminiKeyHint   string `json:"geminiKeyHint,omitempty"`
	SubDLAPIKeySet  bool   `json:"subdlApiKeySet"`
	SubDLAPIKeyHint string `json:"subdlApiKeyHint,omitempty"`
}
