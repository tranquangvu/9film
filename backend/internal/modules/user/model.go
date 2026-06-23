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
	GeminiAPIKey          string
	OpenSubtitlesAPIKey   string
	OpenSubtitlesUsername string
	OpenSubtitlesPassword string
}

// CredentialStatus is the secret-free view sent to the client: only whether
// each credential is set and whether the integration is usable (the user's key
// or the .env fallback). No credential value — not even the username — is ever
// echoed back.
type CredentialStatus struct {
	GeminiKeySet             bool `json:"geminiKeySet"`
	GeminiConfigured         bool `json:"geminiConfigured"`
	OpenSubtitlesAPIKeySet   bool `json:"openSubtitlesApiKeySet"`
	OpenSubtitlesUsernameSet bool `json:"openSubtitlesUsernameSet"`
	OpenSubtitlesPasswordSet bool `json:"openSubtitlesPasswordSet"`
	OpenSubtitlesConfigured  bool `json:"openSubtitlesConfigured"`
}
