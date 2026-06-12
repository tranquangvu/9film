package store

type Progress struct {
	ImdbID          string  `json:"imdbId"`
	Season          int     `json:"season"`
	Episode         int     `json:"episode"`
	PositionSeconds float64 `json:"positionSeconds"`
	DurationSeconds float64 `json:"durationSeconds"`
	UpdatedAt       string  `json:"updatedAt"`
}

// GetProgress returns all of a user's resume points, most recently updated first
// (this ordering drives the "Continue Watching" row).
func (s *Store) GetProgress(userID int64) ([]Progress, error) {
	rows, err := s.db.Query(
		`SELECT imdb_id, season, episode, position_seconds, duration_seconds, updated_at
		   FROM progress WHERE user_id = ?
		   ORDER BY updated_at DESC`,
		userID,
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

// UpsertProgress writes the single resume point for a title (one row per
// user+imdb_id), refreshing updated_at so it bubbles to the top of the list.
func (s *Store) UpsertProgress(userID int64, p Progress) error {
	_, err := s.db.Exec(
		`INSERT INTO progress (user_id, imdb_id, season, episode, position_seconds, duration_seconds, updated_at)
		   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET
		     season = excluded.season,
		     episode = excluded.episode,
		     position_seconds = excluded.position_seconds,
		     duration_seconds = excluded.duration_seconds,
		     updated_at = datetime('now')`,
		userID, p.ImdbID, p.Season, p.Episode, p.PositionSeconds, p.DurationSeconds,
	)
	return err
}
