package store

type ListItem struct {
	ImdbID    string `json:"imdbId"`
	Kind      string `json:"kind"`
	MediaType string `json:"mediaType"`
	CreatedAt string `json:"createdAt"`
}

// ListItems returns a user's saved items of a given kind (favorite|watchlist),
// newest first.
func (s *Store) ListItems(userID int64, kind string) ([]ListItem, error) {
	rows, err := s.db.Query(
		`SELECT imdb_id, kind, media_type, created_at
		   FROM list_items WHERE user_id = ? AND kind = ?
		   ORDER BY created_at DESC`,
		userID, kind,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ListItem, 0)
	for rows.Next() {
		var it ListItem
		if err := rows.Scan(&it.ImdbID, &it.Kind, &it.MediaType, &it.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// AddListItem upserts a saved item (idempotent on the user_id+imdb_id+kind PK).
func (s *Store) AddListItem(userID int64, imdbID, kind, mediaType string) error {
	_, err := s.db.Exec(
		`INSERT INTO list_items (user_id, imdb_id, kind, media_type)
		   VALUES (?, ?, ?, ?)
		   ON CONFLICT(user_id, imdb_id, kind) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, kind, mediaType,
	)
	return err
}

func (s *Store) RemoveListItem(userID int64, imdbID, kind string) error {
	_, err := s.db.Exec(
		`DELETE FROM list_items WHERE user_id = ? AND imdb_id = ? AND kind = ?`,
		userID, imdbID, kind,
	)
	return err
}
