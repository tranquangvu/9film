package user

type signupRequest struct {
	Username string `json:"username"`
}

type loginRequest struct {
	Username string `json:"username"`
}
