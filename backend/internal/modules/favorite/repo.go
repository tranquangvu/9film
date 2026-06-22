package favorite

import "database/sql"

// Repository is the persistence contract for a user's favorites/watchlist. The
// default implementation is SQLite-backed (the physical table is `favorites`).
type Repository interface {
	Favorites(userID int64, limit, offset int) ([]Favorite, error)
	FavoritedIds(userID int64) (map[string]struct{}, error)
	IsFavorited(userID int64, imdbID string) (bool, error)
	AddFavorite(userID int64, imdbID, mediaType string) error
	RemoveFavorite(userID int64, imdbID string) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// Favorites returns a page of a user's favorited titles, newest first.
func (r *repository) Favorites(userID int64, limit, offset int) ([]Favorite, error) {
	rows, err := r.db.Query(
		`SELECT imdb_id, media_type, created_at
		   FROM favorites WHERE user_id = ?
		   ORDER BY created_at DESC
		   LIMIT ? OFFSET ?`,
		userID, limit, offset,
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

// FavoritedIds returns the set of a user's favorited imdb ids, for marking the
// `isFavorite` flag on title listings without sending the whole list to the client.
func (r *repository) FavoritedIds(userID int64) (map[string]struct{}, error) {
	rows, err := r.db.Query(`SELECT imdb_id FROM favorites WHERE user_id = ?`, userID)
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

// IsFavorited reports whether a user has favorited a single title — a targeted
// existence check for the title-detail endpoint, avoiding loading the whole set.
func (r *repository) IsFavorited(userID int64, imdbID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM favorites WHERE user_id = ? AND imdb_id = ?)`,
		userID, imdbID,
	).Scan(&exists)
	return exists, err
}

// AddFavorite upserts a favorite (idempotent on the user_id+imdb_id PK).
func (r *repository) AddFavorite(userID int64, imdbID, mediaType string) error {
	_, err := r.db.Exec(
		`INSERT INTO favorites (user_id, imdb_id, media_type)
		   VALUES (?, ?, ?)
		   ON CONFLICT(user_id, imdb_id) DO UPDATE SET media_type = excluded.media_type`,
		userID, imdbID, mediaType,
	)
	return err
}

func (r *repository) RemoveFavorite(userID int64, imdbID string) error {
	_, err := r.db.Exec(
		`DELETE FROM favorites WHERE user_id = ? AND imdb_id = ?`,
		userID, imdbID,
	)
	return err
}
