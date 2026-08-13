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

// Migrate creates the schema if it doesn't exist. Every table is declared with
// its full set of columns here, so a fresh database is complete after one pass;
// columns added to an existing table are backfilled by the ensureColumn calls
// after the CREATE block. Statements are idempotent so it can run on every
// startup.
func Migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			username   TEXT UNIQUE NOT NULL,
			avatar     TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		// Rename the account seeded under the old name, before the seed below can
		// insert a fresh one. Without this, renaming the local account would leave
		// every favorite, resume point and saved word behind on the old row while
		// the app booted into an empty one. The guard keeps it a no-op once the
		// rename has happened, and skips it entirely if both names somehow exist
		// (username is UNIQUE, so the UPDATE would otherwise fail).
		`UPDATE users SET username = '9film',
			avatar = CASE avatar
				-- Only the untouched generated default follows the rename; an avatar
				-- the user picked themselves is left alone.
				WHEN 'https://api.dicebear.com/10.x/thumbs/svg?seed=iami'
					THEN 'https://api.dicebear.com/10.x/thumbs/svg?seed=9film'
				ELSE avatar
			END
			WHERE username = 'iami'
			  AND NOT EXISTS (SELECT 1 FROM users WHERE username = '9film')`,
		// Seed the local account this app runs as — see user.LocalUserID, which
		// looks it up by exactly this name. There is no sign-in; the row exists to
		// own the user_id every other table is keyed by.
		`INSERT OR IGNORE INTO users (username, avatar)
			VALUES ('9film', 'https://api.dicebear.com/10.x/thumbs/svg?seed=9film')`,
		`CREATE TABLE IF NOT EXISTS favorites (
			user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id    TEXT NOT NULL,
			media_type TEXT NOT NULL DEFAULT 'movie' CHECK(media_type IN ('movie','series')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id)
		)`,
		// A row per (user, title, episode) holding both the resume point and the
		// chosen subtitle. position/duration are 0 for a subtitle-only row (a track
		// picked before any progress). sub_ref is the opaque "<provider>:<ref>"
		// subtitle id, empty when none is set; sub_file_id is the legacy
		// OpenSubtitles-only id, kept for the backfill below and no longer written.
		`CREATE TABLE IF NOT EXISTS history (
			user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			imdb_id      TEXT NOT NULL,
			season       INTEGER NOT NULL DEFAULT 0,
			episode      INTEGER NOT NULL DEFAULT 0,
			position     REAL NOT NULL DEFAULT 0,
			duration     REAL NOT NULL DEFAULT 0,
			sub_file_id  INTEGER,
			sub_ref      TEXT NOT NULL DEFAULT '',
			sub_language TEXT NOT NULL DEFAULT '',
			updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (user_id, imdb_id, season, episode)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			user_id               INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			autoplay_next         INTEGER NOT NULL DEFAULT 1,
			default_subtitle_lang TEXT NOT NULL DEFAULT 'en',
			learning_mode         INTEGER NOT NULL DEFAULT 1,
			learning_lang         TEXT NOT NULL DEFAULT 'vi',
			updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		// Per-user API credentials for the optional integrations. Each account
		// supplies its own keys; the backend .env keys are a fallback.
		// Databases created before OpenSubtitles was unwired still carry its three
		// columns. They all default to '', so leaving them behind costs nothing and
		// keeps the removal non-destructive.
		`CREATE TABLE IF NOT EXISTS credentials (
			user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			gemini_api_key TEXT NOT NULL DEFAULT '',
			subdl_api_key  TEXT NOT NULL DEFAULT '',
			updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		// A saved vocabulary word with its capture context, list membership, and
		// SM-2 review schedule. list: ''=personal, 'oxford3000'=imported starter
		// pack. SM-2: due_at='' until the word is first completed; ease starts at
		// 2.5; interval is in days; reps is the successful-streak count. kind:
		// 'word' (default) or 'phrase' (idiom).
		`CREATE TABLE IF NOT EXISTS words (
			user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			word             TEXT NOT NULL,
			sentence         TEXT NOT NULL DEFAULT '',
			translation      TEXT NOT NULL DEFAULT '',
			imdb_id          TEXT NOT NULL DEFAULT '',
			title            TEXT NOT NULL DEFAULT '',
			season           INTEGER NOT NULL DEFAULT 0,
			episode          INTEGER NOT NULL DEFAULT 0,
			timestamp        REAL NOT NULL DEFAULT 0,
			created_at       TEXT NOT NULL DEFAULT (datetime('now')),
			completed_at     TEXT NOT NULL DEFAULT '',
			list             TEXT NOT NULL DEFAULT '',
			due_at           TEXT NOT NULL DEFAULT '',
			ease             REAL NOT NULL DEFAULT 2.5,
			interval         INTEGER NOT NULL DEFAULT 0,
			reps             INTEGER NOT NULL DEFAULT 0,
			kind             TEXT NOT NULL DEFAULT 'word',
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
		// Due-for-review queue: WHERE user_id=? AND due_at!='' AND due_at<=now.
		`CREATE INDEX IF NOT EXISTS idx_words_user_due ON words(user_id, due_at)`,
		// A completed vocabulary self-test over a completed-date group: per-word
		// spelling attempts + AI-graded meaning answers. The per-word breakdown is
		// stored as a JSON blob in `items` (read-mostly, never queried by field).
		`CREATE TABLE IF NOT EXISTS word_tests (
			id               INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			list             TEXT NOT NULL DEFAULT '',
			group_label      TEXT NOT NULL DEFAULT '',
			total            INTEGER NOT NULL DEFAULT 0,
			spelling_correct INTEGER NOT NULL DEFAULT 0,
			meaning_correct  INTEGER NOT NULL DEFAULT 0,
			items            TEXT NOT NULL DEFAULT '[]',
			created_at       TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		// Test history: WHERE user_id=? ORDER BY created_at DESC.
		`CREATE INDEX IF NOT EXISTS idx_word_tests_user_created ON word_tests(user_id, created_at DESC)`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	// Additive column migrations for databases created before a column existed.
	// CREATE TABLE IF NOT EXISTS won't add columns to an existing table, so these
	// backfill them in place (idempotent — skipped when the column is present).
	if err := ensureColumn(db, "words", "title", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "history", "sub_ref", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "credentials", "subdl_api_key", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}

	// Subtitle ids became opaque "<provider>:<ref>" strings when SubDL was added;
	// rows written before that hold a bare OpenSubtitles file id. Idempotent —
	// only rows the backfill hasn't touched yet match.
	if _, err := db.Exec(
		`UPDATE history SET sub_ref = 'opensubtitles:' || sub_file_id
		   WHERE sub_ref = '' AND sub_file_id IS NOT NULL AND sub_file_id > 0`,
	); err != nil {
		return err
	}

	// SubDL search results arrive with the account's API key spliced into the
	// archive path, and it used to ride along into the stored subtitle id. Cut it
	// back out, keeping any "|SxxEyy" episode hint that follows it — without that
	// the season-pack unpacker would lose track of which episode a ref means.
	// Idempotent: after this no row still matches. The keys that already reached a
	// browser are not recoverable, so rotate SUBDL_API_KEY as well.
	if _, err := db.Exec(
		`UPDATE history
		    SET sub_ref = substr(sub_ref, 1, instr(sub_ref, '?api_key=') - 1) ||
		                  CASE WHEN instr(sub_ref, '|') > 0
		                       THEN substr(sub_ref, instr(sub_ref, '|'))
		                       ELSE '' END
		  WHERE instr(sub_ref, '?api_key=') > 0`,
	); err != nil {
		return err
	}

	// Word illustrations were removed; drop what older databases still carry.
	if _, err := db.Exec(`DROP TABLE IF EXISTS word_images`); err != nil {
		return err
	}
	for _, col := range []string{"image_status", "image_updated_at"} {
		if err := dropColumn(db, "words", col); err != nil {
			return err
		}
	}
	return nil
}

// ensureColumn adds `col` to `table` when it's missing, leaving existing rows at
// the column default. Idempotent: a no-op once the column exists.
func ensureColumn(db *sql.DB, table, col, ddl string) error {
	rows, err := db.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		if name == col {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, col, ddl))
	return err
}

// dropColumn removes `col` from `table` when it's still present, discarding its
// data. Idempotent: a no-op once the column is gone.
func dropColumn(db *sql.DB, table, col string) error {
	rows, err := db.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return err
	}
	defer rows.Close()
	found := false
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		if name == col {
			found = true
			break
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if !found {
		return nil
	}
	// Close the cursor before the ALTER: SQLite won't schema-change a table with
	// an open read on it.
	rows.Close()
	_, err = db.Exec(fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", table, col))
	return err
}
