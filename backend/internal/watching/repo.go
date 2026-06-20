package watching

import "database/sql"

// Repository is the persistence contract for watch progress and per-title
// subtitle preferences. The default implementation is SQLite-backed.
type Repository interface {
	GetTitleProgress(userID int64, imdbID string) ([]Progress, error)
	ContinueWatching(userID int64, limit, offset int) ([]Progress, error)
	UpsertProgress(userID int64, p Progress) error
	GetTitleSubtitle(userID int64, imdbID string) (*Subtitle, error)
	UpsertSubtitle(userID int64, p Subtitle) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// GetTitleProgress returns a user's resume points for a single title, most
// recently updated first. Embedded in the title detail response so the client
// gets per-title progress (watched episodes, resume point) without a separate
// /progress call for every title.
func (r *repository) GetTitleProgress(userID int64, imdbID string) ([]Progress, error) {
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
// list — unlike GetTitleProgress, which returns every per-episode row.
func (r *repository) ContinueWatching(userID int64, limit, offset int) ([]Progress, error) {
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
func (r *repository) UpsertProgress(userID int64, p Progress) error {
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
func (r *repository) GetTitleSubtitle(userID int64, imdbID string) (*Subtitle, error) {
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
func (r *repository) UpsertSubtitle(userID int64, p Subtitle) error {
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
