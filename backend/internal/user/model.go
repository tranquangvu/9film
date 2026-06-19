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

type Favorite struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
	CreatedAt string `json:"createdAt"`
}

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	UpdatedAt       string  `json:"updatedAt"`
}

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}
