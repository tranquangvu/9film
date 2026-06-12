package store

// migrate creates the schema if it doesn't exist. Statements are idempotent so
// this can run on every startup.
func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			email         TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			name          TEXT NOT NULL,
			avatar        TEXT,
			plan          TEXT NOT NULL DEFAULT 'free',
			created_at    TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS list_items (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id    TEXT NOT NULL,
			kind       TEXT NOT NULL CHECK(kind IN ('favorite','watchlist')),
			media_type TEXT NOT NULL DEFAULT 'movie' CHECK(media_type IN ('movie','series')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id, kind)
		)`,
		`CREATE TABLE IF NOT EXISTS progress (
			user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id          TEXT NOT NULL,
			season           INTEGER NOT NULL DEFAULT 0,
			episode          INTEGER NOT NULL DEFAULT 0,
			position_seconds REAL NOT NULL,
			duration_seconds REAL NOT NULL,
			updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			autoplay_next         INTEGER NOT NULL DEFAULT 1,
			default_subtitle_lang TEXT NOT NULL DEFAULT 'en',
			default_quality       TEXT NOT NULL DEFAULT 'auto',
			learning_mode         INTEGER NOT NULL DEFAULT 1,
			learning_lang         TEXT NOT NULL DEFAULT 'vi',
			updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS saved_words (
			user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			word        TEXT NOT NULL,
			sentence    TEXT NOT NULL DEFAULT '',
			translation TEXT NOT NULL DEFAULT '',
			imdb_id     TEXT NOT NULL DEFAULT '',
			season      INTEGER NOT NULL DEFAULT 0,
			episode     INTEGER NOT NULL DEFAULT 0,
			timestamp   REAL NOT NULL DEFAULT 0,
			box         INTEGER NOT NULL DEFAULT 0,
			due_at      TEXT NOT NULL DEFAULT (datetime('now')),
			created_at  TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, word)
		)`,
	}

	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}

	// Idempotent column adds for settings tables created before these columns
	// existed. SQLite errors if the column already exists, so failures here are
	// ignored (the CREATE above already includes them for fresh databases).
	alters := []string{
		`ALTER TABLE settings ADD COLUMN learning_mode INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE settings ADD COLUMN learning_lang TEXT NOT NULL DEFAULT 'vi'`,
	}
	for _, stmt := range alters {
		_, _ = s.db.Exec(stmt)
	}
	return nil
}
