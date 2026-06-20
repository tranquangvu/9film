package user

import (
	"database/sql"
	"errors"
)

// Repository is the persistence contract for user accounts and settings. The
// default implementation is SQLite-backed; the interface lets the service be
// tested against a mock.
type Repository interface {
	CreateUser(email, passwordHash, name, avatar string) (*User, error)
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id int64) (*User, error)
	GetSettings(userID int64) (Settings, error)
	UpsertSettings(userID int64, st Settings) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// CreateUser inserts a new user and returns it with its assigned id.
// The caller is responsible for hashing the password.
func (r *repository) CreateUser(email, passwordHash, name, avatar string) (*User, error) {
	res, err := r.db.Exec(
		`INSERT INTO users (email, password_hash, name, avatar) VALUES (?, ?, ?, ?)`,
		email, passwordHash, name, avatar,
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

func (r *repository) GetUserByEmail(email string) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE email = ?`,
		email,
	))
}

func (r *repository) GetUserByID(id int64) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE id = ?`,
		id,
	))
}

func (r *repository) scanUser(row *sql.Row) (*User, error) {
	var u User
	var avatar sql.NullString
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &avatar, &u.Plan, &u.CreatedAt)
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
		DefaultQuality:      "auto",
		LearningMode:        true,
		LearningLang:        "vi",
	}
}

// GetSettings returns a user's settings, or sensible defaults if none are stored.
func (r *repository) GetSettings(userID int64) (Settings, error) {
	var st Settings
	var autoplay, learning int
	err := r.db.QueryRow(
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
