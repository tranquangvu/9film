package favorite

import "database/sql"

// Repository is the persistence contract for a user's favorites/watchlist. The
// default implementation is SQLite-backed (the physical table is `list_items`).
type Repository interface {
	Favorites(userID int64) ([]Favorite, error)
	FavoritedSet(userID int64) (map[string]struct{}, error)
	AddFavorite(userID int64, imdbID, mediaType string) error
	RemoveFavorite(userID int64, imdbID string) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// Favorites returns a user's favorited titles, newest first.
func (r *repository) Favorites(userID int64) ([]Favorite, error) {
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
func (r *repository) FavoritedSet(userID int64) (map[string]struct{}, error) {
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
func (r *repository) AddFavorite(userID int64, imdbID, mediaType string) error {
	_, err := r.db.Exec(
		`INSERT INTO list_items (user_id, imdb_id, media_type)
		   VALUES (?, ?, ?)
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, mediaType,
	)
	return err
}

func (r *repository) RemoveFavorite(userID int64, imdbID string) error {
	_, err := r.db.Exec(
		`DELETE FROM list_items WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	)
	return err
}
