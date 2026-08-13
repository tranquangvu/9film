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
// is set, and nothing else. A key that isn't set means that integration is off,
// so this doubles as the signal the UI uses to offer adding one. No credential
// value is ever echoed back.
type CredentialStatus struct {
	GeminiKeySet   bool `json:"geminiKeySet"`
	SubDLAPIKeySet bool `json:"subdlApiKeySet"`
}
