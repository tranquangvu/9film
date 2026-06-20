package user

import "errors"

var ErrNotFound = errors.New("not found")

type User struct {
	ID           int64  `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Name         string `json:"name"`
	Avatar       string `json:"avatar"`
	Plan         string `json:"plan"`
	CreatedAt    string `json:"createdAt"`
}

type Settings struct {
	AutoplayNext        bool   `json:"autoplayNext"`
	DefaultSubtitleLang string `json:"defaultSubtitleLang"`
	DefaultQuality      string `json:"defaultQuality"`
	LearningMode        bool   `json:"learningMode"`
	LearningLang        string `json:"learningLang"`
}
