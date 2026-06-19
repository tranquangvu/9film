package store

type Favorite struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
	CreatedAt string `json:"createdAt"`
}

// Favorites returns a user's favorited titles, newest first.
// (The physical table is still `list_items`.)
func (s *Store) Favorites(userID int64) ([]Favorite, error) {
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
func (s *Store) FavoritedSet(userID int64) (map[string]struct{}, error) {
	rows, err := s.db.Query(`SELECT imdb_id FROM list_items WHERE user_id = ?`, userID)
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
func (s *Store) AddFavorite(userID int64, imdbID, mediaType string) error {
	_, err := s.db.Exec(
		`INSERT INTO list_items (user_id, imdb_id, media_type)
		   VALUES (?, ?, ?)
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, mediaType,
	)
	return err
}

func (s *Store) RemoveFavorite(userID int64, imdbID string) error {
	_, err := s.db.Exec(
		`DELETE FROM list_items WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	)
	return err
}
