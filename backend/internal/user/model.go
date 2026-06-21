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
	DefaultQuality      string `json:"defaultQuality"`
	LearningMode        bool   `json:"learningMode"`
	LearningLang        string `json:"learningLang"`
}
