package store

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}

// GetSubtitles returns a user's saved subtitle selections (one per title).
func (s *Store) GetSubtitles(userID int64) ([]Subtitle, error) {
	rows, err := s.db.Query(
		`SELECT imdb_id, file_id, language FROM subtitles WHERE user_id = ?`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Subtitle, 0)
	for rows.Next() {
		var p Subtitle
		if err := rows.Scan(&p.ImdbID, &p.FileID, &p.Language); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// UpsertSubtitle saves the subtitle a user picked for a title (one row per
// user+imdb_id).
func (s *Store) UpsertSubtitle(userID int64, p Subtitle) error {
	_, err := s.db.Exec(
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
