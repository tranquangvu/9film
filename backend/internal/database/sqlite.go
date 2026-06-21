// Package database owns the SQLite connection and schema. It hands a *sql.DB to
// each module's repository; the pure-Go modernc.org/sqlite driver keeps the
// build cgo-free.
package database

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// One connection avoids "database is locked" under SQLite's single-writer
	// model while still being plenty for this workload.
	db.SetMaxOpenConns(1)

	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		// NORMAL is the recommended durability level under WAL: it fsyncs at
		// checkpoints rather than on every commit, so frequent progress upserts
		// during playback don't each pay a full fsync. (FULL is the default.)
		"PRAGMA synchronous=NORMAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA busy_timeout=5000",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", pragma, err)
		}
	}

	if err := Migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return db, nil
}

// Migrate creates the schema if it doesn't exist. Statements are idempotent so
// it can run on every startup.
func Migrate(db *sql.DB) error {
	// word_images briefly stored a raster PNG BLOB; it now holds SVG markup. The
	// table is regenerated on demand, so dropping the old shape (and its bytes)
	// is safe — the CREATE below remakes it.
	if hasPng, err := hasColumn(db, "word_images", "png"); err != nil {
		return err
	} else if hasPng {
		if _, err := db.Exec(`DROP TABLE word_images`); err != nil {
			return err
		}
	}

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			username   TEXT UNIQUE NOT NULL,
			avatar     TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		// Seed the default local account. The app is password-less and single-user
		// by default: signing in with this username is enough to get in.
		`INSERT OR IGNORE INTO users (username, avatar)
			VALUES ('iami', 'https://api.dicebear.com/7.x/avataaars/svg?seed=iami')`,
		`CREATE TABLE IF NOT EXISTS favorites (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id    TEXT NOT NULL,
			media_type TEXT NOT NULL DEFAULT 'movie' CHECK(media_type IN ('movie','series')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id)
		)`,
		// A row per (user, title, episode) holding both the resume point and the
		// chosen subtitle. position/duration are 0 for a subtitle-only row (a track
		// picked before any progress); sub_file_id is NULL when no subtitle is set.
		`CREATE TABLE IF NOT EXISTS history (
			user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id      TEXT NOT NULL,
			season       INTEGER NOT NULL DEFAULT 0,
			episode      INTEGER NOT NULL DEFAULT 0,
			position     REAL NOT NULL DEFAULT 0,
			duration     REAL NOT NULL DEFAULT 0,
			sub_file_id  INTEGER,
			sub_language TEXT NOT NULL DEFAULT '',
			updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
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
		`CREATE TABLE IF NOT EXISTS words (
			user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			word        TEXT NOT NULL,
			sentence    TEXT NOT NULL DEFAULT '',
			translation TEXT NOT NULL DEFAULT '',
			imdb_id     TEXT NOT NULL DEFAULT '',
			season      INTEGER NOT NULL DEFAULT 0,
			episode     INTEGER NOT NULL DEFAULT 0,
			timestamp    REAL NOT NULL DEFAULT 0,
			created_at   TEXT NOT NULL DEFAULT (datetime('now')),
			completed_at TEXT NOT NULL DEFAULT '',
			PRIMARY KEY (user_id, word)
		)`,
		// Secondary indexes for the per-user list queries whose filter/sort
		// columns the primary keys don't already cover.
		// Continue Watching: WHERE user_id=? AND duration>0 ORDER BY updated_at DESC.
		`CREATE INDEX IF NOT EXISTS idx_history_user_updated ON history(user_id, updated_at DESC)`,
		// Watchlist: WHERE user_id=? ORDER BY created_at DESC.
		`CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC)`,
		// Saved words: WHERE user_id=? AND completed_at (?='') ORDER BY created_at/completed_at.
		`CREATE INDEX IF NOT EXISTS idx_words_user_completed ON words(user_id, completed_at, created_at)`,
		// Generated AI illustration (SVG markup) for a saved word, kept out of the
		// words list query so that SELECT stays lean.
		`CREATE TABLE IF NOT EXISTS word_images (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			word       TEXT NOT NULL,
			svg        TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, word)
		)`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	// Additive column migrations: the statements above are CREATE-only, so new
	// columns on an existing table need a guarded ALTER (SQLite has no
	// ADD COLUMN IF NOT EXISTS). image_status: ''=unknown/legacy, pending, ready,
	// failed; image_updated_at is a cache-bust token bumped on each generation.
	if err := addColumnIfMissing(db, "words", "image_status", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "words", "image_updated_at", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	return nil
}

// hasColumn reports whether a table already has the named column. A missing
// table yields no rows, so it returns false.
func hasColumn(db *sql.DB, table, col string) (bool, error) {
	rows, err := db.Query("SELECT name FROM pragma_table_info(?)", table)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return false, err
		}
		if name == col {
			return true, nil
		}
	}
	return false, rows.Err()
}

// addColumnIfMissing adds a column to a table only when it isn't already there,
// making additive schema changes idempotent across restarts and existing DBs.
func addColumnIfMissing(db *sql.DB, table, col, ddl string) error {
	has, err := hasColumn(db, table, col)
	if err != nil || has {
		return err
	}
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, col, ddl))
	return err
}
