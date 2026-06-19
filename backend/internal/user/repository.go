package user

import (
	"database/sql"
	"errors"
)

// Repository is the SQLite-backed persistence layer for user data (accounts,
// settings, favorites/watchlist, watch progress, subtitle preferences).
type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// CreateUser inserts a new user and returns it with its assigned id.
// The caller is responsible for hashing the password.
func (r *Repository) CreateUser(email, passwordHash, name, avatar string) (*User, error) {
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

func (r *Repository) GetUserByEmail(email string) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE email = ?`,
		email,
	))
}

func (r *Repository) GetUserByID(id int64) (*User, error) {
	return r.scanUser(r.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE id = ?`,
		id,
	))
}

func (r *Repository) scanUser(row *sql.Row) (*User, error) {
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
func (r *Repository) GetSettings(userID int64) (Settings, error) {
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

func (r *Repository) UpsertSettings(userID int64, st Settings) error {
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

// Favorites returns a user's favorited titles, newest first.
// (The physical table is still `list_items`.)
func (r *Repository) Favorites(userID int64) ([]Favorite, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, media_type, created_at
		   FROM list_items WHERE user_id = ?
		   ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Favorite, 0)
	for rows.Next() {
		var it Favorite
		if err := rows.Scan(&it.ImdbID, &it.MediaType, &it.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// FavoritedSet returns the set of a user's favorited imdb ids, for marking the
// `isFavorite` flag on title listings without sending the whole list to the client.
func (r *Repository) FavoritedSet(userID int64) (map[string]struct{}, error) {
	rows, err := r.db.Query(`SELECT imdb_id FROM list_items WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	set := make(map[string]struct{})
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		set[id] = struct{}{}
	}
	return set, rows.Err()
}

// AddFavorite upserts a favorite (idempotent on the user_id+imdb_id PK).
func (r *Repository) AddFavorite(userID int64, imdbID, mediaType string) error {
	_, err := r.db.Exec(
		`INSERT INTO list_items (user_id, imdb_id, media_type)
		   VALUES (?, ?, ?)
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, mediaType,
	)
	return err
}

func (r *Repository) RemoveFavorite(userID int64, imdbID string) error {
	_, err := r.db.Exec(
		`DELETE FROM list_items WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	)
	return err
}

// GetTitleProgress returns a user's resume points for a single title, most
// recently updated first. Embedded in the title detail response so the client
// gets per-title progress (watched episodes, resume point) without a separate
// /progress call for every title.
func (r *Repository) GetTitleProgress(userID int64, imdbID string) ([]Progress, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, season, episode, position_seconds, duration_seconds, updated_at
		   FROM progress WHERE user_id = ? AND imdb_id = ?
		   ORDER BY updated_at DESC`,
		userID, imdbID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Progress, 0)
	for rows.Next() {
		var p Progress
		if err := rows.Scan(&p.ImdbID, &p.Season, &p.Episode, &p.PositionSeconds, &p.DurationSeconds, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// ContinueWatching returns the most recent resume point per title (one row per
// imdb_id, picking the latest episode/movie), most recently updated first and
// paginated. This backs the paginated, infinite-scrolling "Continue Watching"
// list — unlike GetProgress, which returns every per-episode row.
func (r *Repository) ContinueWatching(userID int64, limit, offset int) ([]Progress, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, season, episode, position_seconds, duration_seconds, updated_at FROM (
		   SELECT imdb_id, season, episode, position_seconds, duration_seconds, updated_at,
		          ROW_NUMBER() OVER (PARTITION BY imdb_id ORDER BY updated_at DESC, rowid DESC) AS rn
		     FROM progress WHERE user_id = ?
		 ) WHERE rn = 1
		 ORDER BY updated_at DESC
		 LIMIT ? OFFSET ?`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Progress, 0)
	for rows.Next() {
		var p Progress
		if err := rows.Scan(&p.ImdbID, &p.Season, &p.Episode, &p.PositionSeconds, &p.DurationSeconds, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// UpsertProgress writes a resume point keyed by user+imdb_id+season+episode, so
// each TV episode keeps its own position (movies use season/episode 0). It
// refreshes updated_at so the title bubbles to the top of the list.
func (r *Repository) UpsertProgress(userID int64, p Progress) error {
	_, err := r.db.Exec(
		`INSERT INTO progress (user_id, imdb_id, season, episode, position_seconds, duration_seconds, updated_at)
		   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id, imdb_id, season, episode) DO UPDATE SET
		     position_seconds = excluded.position_seconds,
		     duration_seconds = excluded.duration_seconds,
		     updated_at = datetime('now')`,
		userID, p.ImdbID, p.Season, p.Episode, p.PositionSeconds, p.DurationSeconds,
	)
	return err
}

// GetTitleSubtitle returns a user's saved subtitle selection for one title, or
// nil when none is set. Embedded in the title detail response so the player gets
// the preference without a separate /subtitles call per title.
func (r *Repository) GetTitleSubtitle(userID int64, imdbID string) (*Subtitle, error) {
	var p Subtitle
	err := r.db.QueryRow(
		`SELECT imdb_id, file_id, language FROM subtitles WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	).Scan(&p.ImdbID, &p.FileID, &p.Language)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpsertSubtitle saves the subtitle a user picked for a title (one row per
// user+imdb_id).
func (r *Repository) UpsertSubtitle(userID int64, p Subtitle) error {
	_, err := r.db.Exec(
		`INSERT INTO subtitles (user_id, imdb_id, file_id, language, updated_at)
		   VALUES (?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET
		     file_id = excluded.file_id,
		     language = excluded.language,
		     updated_at = datetime('now')`,
		userID, p.ImdbID, p.FileID, p.Language,
	)
	return err
}
