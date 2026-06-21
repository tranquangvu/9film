package user

import (
	"database/sql"
	"errors"
)

// Repository is the persistence contract for user accounts and settings. The
// default implementation is SQLite-backed; the interface lets the service be
// tested against a mock.
type Repository interface {
	CreateUser(username, avatar string) (*User, error)
	GetUserByUsername(username string) (*User, error)
	GetUserByID(id int64) (*User, error)
	UpdateUser(id int64, username, avatar string) (*User, error)
	GetSettings(userID int64) (Settings, error)
	UpsertSettings(userID int64, st Settings) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateUser(username, avatar string) (*User, error) {
	res, err := r.db.Exec(
		`INSERT INTO users (username, avatar) VALUES (?, ?)`,
		username, avatar,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetUserByID(id)
}

func (r *repository) GetUserByUsername(username string) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, username, avatar, created_at FROM users WHERE username = ?`,
		username,
	))
}

func (r *repository) GetUserByID(id int64) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, username, avatar, created_at FROM users WHERE id = ?`,
		id,
	))
}

func (r *repository) UpdateUser(id int64, username, avatar string) (*User, error) {
	if _, err := r.db.Exec(
		`UPDATE users SET username = ?, avatar = ? WHERE id = ?`,
		username, avatar, id,
	); err != nil {
		return nil, err
	}
	return r.GetUserByID(id)
}

func (r *repository) scanUser(row *sql.Row) (*User, error) {
	var u User
	var avatar sql.NullString
	err := row.Scan(&u.ID, &u.Username, &avatar, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	u.Avatar = avatar.String
	return &u, nil
}

func defaultSettings() Settings {
	return Settings{
		AutoplayNext:        true,
		DefaultSubtitleLang: "en",
		LearningMode:        true,
		LearningLang:        "vi",
	}
}

// GetSettings returns a user's settings, or sensible defaults if none are stored.
func (r *repository) GetSettings(userID int64) (Settings, error) {
	var st Settings
	var autoplay, learning int
	err := r.db.QueryRow(
		`SELECT autoplay_next, default_subtitle_lang, learning_mode, learning_lang
		   FROM settings WHERE user_id = ?`,
		userID,
	).Scan(&autoplay, &st.DefaultSubtitleLang, &learning, &st.LearningLang)
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

func (r *repository) UpsertSettings(userID int64, st Settings) error {
	autoplay := 0
	if st.AutoplayNext {
		autoplay = 1
	}
	learning := 0
	if st.LearningMode {
		learning = 1
	}
	_, err := r.db.Exec(
		`INSERT INTO settings (user_id, autoplay_next, default_subtitle_lang, learning_mode, learning_lang, updated_at)
		   VALUES (?, ?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id) DO UPDATE SET
		     autoplay_next = excluded.autoplay_next,
		     default_subtitle_lang = excluded.default_subtitle_lang,
		     learning_mode = excluded.learning_mode,
		     learning_lang = excluded.learning_lang,
		     updated_at = datetime('now')`,
		userID, autoplay, st.DefaultSubtitleLang, learning, st.LearningLang,
	)
	return err
}
