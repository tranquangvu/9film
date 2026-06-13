package store

type ListItem struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
	CreatedAt string `json:"createdAt"`
}

// ListItems returns a user's favorited titles, newest first.
func (s *Store) ListItems(userID int64) ([]ListItem, error) {
	rows, err := s.db.Query(
		`SELECT imdb_id, media_type, created_at
		   FROM list_items WHERE user_id = ?
		   ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ListItem, 0)
	for rows.Next() {
		var it ListItem
		if err := rows.Scan(&it.ImdbID, &it.MediaType, &it.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// AddListItem upserts a favorite (idempotent on the user_id+imdb_id PK).
func (s *Store) AddListItem(userID int64, imdbID, mediaType string) error {
	_, err := s.db.Exec(
		`INSERT INTO list_items (user_id, imdb_id, media_type)
		   VALUES (?, ?, ?)
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, mediaType,
	)
	return err
}

func (s *Store) RemoveListItem(userID int64, imdbID string) error {
	_, err := s.db.Exec(
		`DELETE FROM list_items WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	)
	return err
}
