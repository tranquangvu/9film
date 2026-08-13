package user

type updateMeRequest struct {
	Avatar string `json:"avatar"`
}

// updateCredentialsRequest carries new key values; empty fields are left
// unchanged so the client can update one key without resending the others.
type updateCredentialsRequest struct {
	GeminiApiKey string `json:"geminiApiKey"`
	SubdlApiKey  string `json:"subdlApiKey"`
}
