package history

import "database/sql"

// Repository is the persistence contract for watch progress and per-title
// subtitle preferences. The default implementation is SQLite-backed.
type Repository interface {
	GetTitleProgress(userID int64, imdbID string) ([]Progress, error)
	GetHistory(userID int64, limit, offset int) ([]Progress, error)
	UpsertProgress(userID int64, p Progress) error
	UpsertSubtitle(userID int64, p Subtitle) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// GetTitleProgress returns a user's per-episode rows for a single title (resume
// point + chosen subtitle), most recently updated first. Embedded in the title
// detail response so the client gets progress and the saved subtitle per episode
// without separate /progress or /subtitles calls. Subtitle-only rows (no
// progress yet) are included so the saved track survives.
func (r *repository) GetTitleProgress(userID int64, imdbID string) ([]Progress, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, season, episode, position, duration, sub_file_id, sub_language, updated_at
		   FROM history WHERE user_id = ? AND imdb_id = ?
		   ORDER BY updated_at DESC`,
		userID, imdbID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Progress, 0)
	for rows.Next() {
		p, err := scanProgress(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// scanProgress reads one history row, mapping a NULL sub_file_id to 0.
func scanProgress(rows *sql.Rows) (Progress, error) {
	var p Progress
	var subFileID sql.NullInt64
	if err := rows.Scan(&p.ImdbID, &p.Season, &p.Episode, &p.PositionSeconds, &p.DurationSeconds, &subFileID, &p.SubLanguage, &p.UpdatedAt); err != nil {
		return Progress{}, err
	}
	p.SubFileID = subFileID.Int64
	return p, nil
}

// GetHistory returns the most recent resume point per title (one row per
// imdb_id, picking the latest episode/movie), most recently updated first and
// paginated. This backs the paginated, infinite-scrolling "Continue Watching"
// list — unlike GetTitleProgress, which returns every per-episode row.
func (r *repository) GetHistory(userID int64, limit, offset int) ([]Progress, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, season, episode, position, duration, sub_file_id, sub_language, updated_at FROM (
		   SELECT imdb_id, season, episode, position, duration, sub_file_id, sub_language, updated_at,
		          ROW_NUMBER() OVER (PARTITION BY imdb_id ORDER BY updated_at DESC, rowid DESC) AS rn
		     FROM history WHERE user_id = ? AND duration > 0
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
		p, err := scanProgress(rows)
		if err != nil {
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
		`INSERT INTO history (user_id, imdb_id, season, episode, position, duration, updated_at)
		   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id, imdb_id, season, episode) DO UPDATE SET
		     position = excluded.position,
		     duration = excluded.duration,
		     updated_at = datetime('now')`,
		userID, p.ImdbID, p.Season, p.Episode, p.PositionSeconds, p.DurationSeconds,
	)
	return err
}

// UpsertSubtitle saves the subtitle a user picked for one episode (movies use
// season/episode 0). It writes the subtitle onto that episode's history row,
// creating a subtitle-only row (position/duration 0) if none exists yet, and
// leaves any existing resume point and its updated_at untouched so picking a
// subtitle doesn't reorder Continue Watching.
func (r *repository) UpsertSubtitle(userID int64, p Subtitle) error {
	_, err := r.db.Exec(
		`INSERT INTO history (user_id, imdb_id, season, episode, position, duration, sub_file_id, sub_language)
		   VALUES (?, ?, ?, ?, 0, 0, ?, ?)
		   ON CONFLICT(user_id, imdb_id, season, episode) DO UPDATE SET
		     sub_file_id = excluded.sub_file_id,
		     sub_language = excluded.sub_language`,
		userID, p.ImdbID, p.Season, p.Episode, p.FileID, p.Language,
	)
	return err
}
