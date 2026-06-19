package store

import "database/sql"

type Subtitle struct {
	ImdbID   string `json:"imdbId"`
	FileID   int64  `json:"fileId"`
	Language string `json:"language"`
}

// GetTitleSubtitle returns a user's saved subtitle selection for one title, or
// nil when none is set. Embedded in the title detail response so the player gets
// the preference without a separate /subtitles call per title.
func (s *Store) GetTitleSubtitle(userID int64, imdbID string) (*Subtitle, error) {
	var p Subtitle
	err := s.db.QueryRow(
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
