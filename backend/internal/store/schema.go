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
			media_type TEXT NOT NULL DEFAULT 'movie' CHECK(media_type IN ('movie','series')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id)
		)`,
		`CREATE TABLE IF NOT EXISTS progress (
			user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id          TEXT NOT NULL,
			season           INTEGER NOT NULL DEFAULT 0,
			episode          INTEGER NOT NULL DEFAULT 0,
			position_seconds REAL NOT NULL,
			duration_seconds REAL NOT NULL,
			updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id, season, episode)
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

	if err := s.migrateProgressKey(); err != nil {
		return err
	}
	if err := s.migrateListItemsDropKind(); err != nil {
		return err
	}
	return nil
}

// migrateListItemsDropKind rebuilds list_items when it still carries the old
// `kind` column (favorite|watchlist). The app now only has favorites, so the
// column and PRIMARY KEY (user_id, imdb_id, kind) are dropped down to
// (user_id, imdb_id), keeping only the favorite rows.
func (s *Store) migrateListItemsDropKind() error {
	rows, err := s.db.Query(`PRAGMA table_info(list_items)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasKind := false
	for rows.Next() {
		var (
			cid, notNull, pk int
			name, ctype      string
			dflt             any
		)
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == "kind" {
			hasKind = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if !hasKind {
		return nil // already on the kind-less schema
	}

	stmts := []string{
		`CREATE TABLE list_items_new (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id    TEXT NOT NULL,
			media_type TEXT NOT NULL DEFAULT 'movie' CHECK(media_type IN ('movie','series')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id)
		)`,
		`INSERT OR IGNORE INTO list_items_new (user_id, imdb_id, media_type, created_at)
			SELECT user_id, imdb_id, media_type, created_at FROM list_items WHERE kind = 'favorite'`,
		`DROP TABLE list_items`,
		`ALTER TABLE list_items_new RENAME TO list_items`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// migrateProgressKey rebuilds the progress table when it still uses the original
// (user_id, imdb_id) primary key — one resume point per title. The current schema
// keys by (user_id, imdb_id, season, episode) so each TV episode keeps its own
// resume point. Existing rows map 1:1 to the new table, so no data is lost.
func (s *Store) migrateProgressKey() error {
	rows, err := s.db.Query(`PRAGMA table_info(progress)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	// `season` participates in the PK only under the new schema.
	seasonInPK := false
	for rows.Next() {
		var (
			cid, notNull, pk int
			name, ctype      string
			dflt             any
		)
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == "season" && pk > 0 {
			seasonInPK = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if seasonInPK {
		return nil // already on the per-episode key
	}

	stmts := []string{
		`CREATE TABLE progress_new (
			user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id          TEXT NOT NULL,
			season           INTEGER NOT NULL DEFAULT 0,
			episode          INTEGER NOT NULL DEFAULT 0,
			position_seconds REAL NOT NULL,
			duration_seconds REAL NOT NULL,
			updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id, season, episode)
		)`,
		`INSERT INTO progress_new
			SELECT user_id, imdb_id, season, episode, position_seconds, duration_seconds, updated_at
			FROM progress`,
		`DROP TABLE progress`,
		`ALTER TABLE progress_new RENAME TO progress`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}
