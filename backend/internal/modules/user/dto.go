package user

type signupRequest struct {
	Username string `json:"username"`
}

type loginRequest struct {
	Username string `json:"username"`
}

type updateMeRequest struct {
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

// updateCredentialsRequest carries new key values; empty fields are left
// unchanged so the client can update one key without resending the others.
type updateCredentialsRequest struct {
	GeminiApiKey          string `json:"geminiApiKey"`
	OpenSubtitlesApiKey   string `json:"openSubtitlesApiKey"`
	OpenSubtitlesUsername string `json:"openSubtitlesUsername"`
	OpenSubtitlesPassword string `json:"openSubtitlesPassword"`
}
