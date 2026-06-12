package store

import (
	"database/sql"
	"errors"
)

type Settings struct {
	AutoplayNext        bool   `json:"autoplayNext"`
	DefaultSubtitleLang string `json:"defaultSubtitleLang"`
	DefaultQuality      string `json:"defaultQuality"`
	LearningMode        bool   `json:"learningMode"`
	LearningLang        string `json:"learningLang"`
}

func defaultSettings() Settings {
	return Settings{
		AutoplayNext:        true,
		DefaultSubtitleLang: "en",
		DefaultQuality:      "auto",
		LearningMode:        true,
		LearningLang:        "vi",
	}
}

// GetSettings returns a user's settings, or sensible defaults if none are stored.
func (s *Store) GetSettings(userID int64) (Settings, error) {
	var st Settings
	var autoplay, learning int
	err := s.db.QueryRow(
		`SELECT autoplay_next, default_subtitle_lang, default_quality, learning_mode, learning_lang
		   FROM settings WHERE user_id = ?`,
		userID,
	).Scan(&autoplay, &st.DefaultSubtitleLang, &st.DefaultQuality, &learning, &st.LearningLang)
	if errors.Is(err, sql.ErrNoRows) {
		return defaultSettings(), nil
	}
	if err != nil {
		return Settings{}, err
	}
	st.AutoplayNext = autoplay != 0
	st.LearningMode = learning != 0
	return st, nil
}

func (s *Store) UpsertSettings(userID int64, st Settings) error {
	autoplay := 0
	if st.AutoplayNext {
		autoplay = 1
	}
	learning := 0
	if st.LearningMode {
		learning = 1
	}
	_, err := s.db.Exec(
		`INSERT INTO settings (user_id, autoplay_next, default_subtitle_lang, default_quality, learning_mode, learning_lang, updated_at)
		   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id) DO UPDATE SET
		     autoplay_next = excluded.autoplay_next,
		     default_subtitle_lang = excluded.default_subtitle_lang,
		     default_quality = excluded.default_quality,
		     learning_mode = excluded.learning_mode,
		     learning_lang = excluded.learning_lang,
		     updated_at = datetime('now')`,
		userID, autoplay, st.DefaultSubtitleLang, st.DefaultQuality, learning, st.LearningLang,
	)
	return err
}
