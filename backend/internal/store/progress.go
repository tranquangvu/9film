package store

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	UpdatedAt       string  `json:"updatedAt"`
}

// GetTitleProgress returns a user's resume points for a single title, most
// recently updated first. Embedded in the title detail response so the client
// gets per-title progress (watched episodes, resume point) without a separate
// /progress call for every title.
func (s *Store) GetTitleProgress(userID int64, imdbID string) ([]Progress, error) {
	rows, err := s.db.Query(
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
func (s *Store) ContinueWatching(userID int64, limit, offset int) ([]Progress, error) {
	rows, err := s.db.Query(
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
func (s *Store) UpsertProgress(userID int64, p Progress) error {
	_, err := s.db.Exec(
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
