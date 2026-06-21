package learning

import (
	"database/sql"
	"encoding/json"
)

// Repository is the persistence contract for saved vocabulary words. The default
// implementation is SQLite-backed.
type Repository interface {
	GetWordStats(userID int64) ([]WordStat, error)
	GetWords(userID int64, status, list string, limit, offset int) ([]Word, error)
	GetWord(userID int64, word string) (*Word, error)
	AddWord(userID int64, w Word) error
	BulkAddWords(userID int64, words []string, list string) (int, error)
	RemoveWord(userID int64, word string) error
	CompleteWord(userID int64, word string) error
	SetImageStatus(userID int64, word, status string) error
	SaveImage(userID int64, word string, png []byte) error
	GetImage(userID int64, word string) ([]byte, bool)
	SaveTest(userID int64, t TestResult) (int64, error)
	GetTests(userID int64) ([]TestResult, error)
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	return &repository{db: db}
}

// GetWordStats returns every saved word in lightweight form, newest-added first.
// Backs the progress chart, the to-learn/completed totals, and the saved-word
// set — all of which need the whole vocabulary, not just the current page.
func (r *repository) GetWordStats(userID int64) ([]WordStat, error) {
	rows, err := r.db.Query(
		`SELECT word, created_at, completed_at, list
		   FROM words WHERE user_id = ?
		   ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]WordStat, 0)
	for rows.Next() {
		var w WordStat
		if err := rows.Scan(&w.Word, &w.CreatedAt, &w.CompletedAt, &w.List); err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	return items, rows.Err()
}

// GetWords returns one page of a user's saved words for the given status:
// "completed" (ordered by when they were learned) or anything else meaning
// "to learn" (ordered by when they were added) — newest first either way. Backs
// the per-tab infinite-scrolling lists on the learning page.
func (r *repository) GetWords(userID int64, status, list string, limit, offset int) ([]Word, error) {
	where, order := "completed_at = ''", "created_at DESC"
	if status == "completed" {
		where, order = "completed_at != ''", "completed_at DESC"
	} else if list != "" {
		// Imported lists (e.g. the Oxford 3000) are studied alphabetically, not
		// by recency — they're all added at once.
		order = "word ASC"
	}
	rows, err := r.db.Query(
		`SELECT word, sentence, translation, imdb_id, season, episode, timestamp, created_at, completed_at, image_status, image_updated_at, list
		   FROM words WHERE user_id = ? AND list = ? AND `+where+`
		   ORDER BY `+order+`
		   LIMIT ? OFFSET ?`,
		userID, list, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Word, 0)
	for rows.Next() {
		w, err := scanWord(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	return items, rows.Err()
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanWord(row rowScanner) (Word, error) {
	var w Word
	err := row.Scan(
		&w.Word, &w.Sentence, &w.Translation, &w.ImdbID,
		&w.Season, &w.Episode, &w.Timestamp, &w.CreatedAt, &w.CompletedAt,
		&w.ImageStatus, &w.ImageUpdatedAt, &w.List,
	)
	return w, err
}

// GetWord returns a single saved word (used to build the image prompt and to
// confirm ownership before (re)generating). Returns (nil, nil) when not found.
func (r *repository) GetWord(userID int64, word string) (*Word, error) {
	w, err := scanWord(r.db.QueryRow(
		`SELECT word, sentence, translation, imdb_id, season, episode, timestamp, created_at, completed_at, image_status, image_updated_at, list
		   FROM words WHERE user_id = ? AND word = ?`,
		userID, word,
	))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// AddWord upserts a word (idempotent on the user_id+word PK). Re-saving a word
// refreshes its context/scene but leaves its completed state untouched.
func (r *repository) AddWord(userID int64, w Word) error {
	// Re-saving an existing word leaves its image columns untouched (the service
	// decides whether to (re)generate); a new row defaults image_status to ''.
	_, err := r.db.Exec(
		`INSERT INTO words
		   (user_id, word, sentence, translation, imdb_id, season, episode, timestamp)
		   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		   ON CONFLICT(user_id, word) DO UPDATE SET
		     sentence = excluded.sentence,
		     translation = excluded.translation,
		     imdb_id = excluded.imdb_id,
		     season = excluded.season,
		     episode = excluded.episode,
		     timestamp = excluded.timestamp`,
		userID, w.Word, w.Sentence, w.Translation, w.ImdbID, w.Season, w.Episode, w.Timestamp,
	)
	return err
}

// SetImageStatus updates only the image_status of a word (e.g. -> 'failed' or
// 'pending' before a regeneration).
func (r *repository) SetImageStatus(userID int64, word, status string) error {
	_, err := r.db.Exec(
		`UPDATE words SET image_status = ? WHERE user_id = ? AND word = ?`,
		status, userID, word,
	)
	return err
}

// SaveImage stores the generated SVG markup and flips the word to 'ready',
// bumping the cache-bust token.
func (r *repository) SaveImage(userID int64, word string, svg []byte) error {
	if _, err := r.db.Exec(
		`INSERT INTO word_images (user_id, word, svg, updated_at)
		   VALUES (?, ?, ?, datetime('now'))
		   ON CONFLICT(user_id, word) DO UPDATE SET svg = excluded.svg, updated_at = datetime('now')`,
		userID, word, svg,
	); err != nil {
		return err
	}
	_, err := r.db.Exec(
		`UPDATE words SET image_status = 'ready', image_updated_at = datetime('now') WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}

// GetImage returns a word's stored SVG bytes, or (nil, false) when none exists.
func (r *repository) GetImage(userID int64, word string) ([]byte, bool) {
	var svg []byte
	err := r.db.QueryRow(
		`SELECT svg FROM word_images WHERE user_id = ? AND word = ?`,
		userID, word,
	).Scan(&svg)
	if err != nil {
		return nil, false
	}
	return svg, true
}

// SaveTest persists a graded self-test (the per-word breakdown as a JSON blob)
// and returns its new id.
func (r *repository) SaveTest(userID int64, t TestResult) (int64, error) {
	itemsJSON, err := json.Marshal(t.Items)
	if err != nil {
		return 0, err
	}
	res, err := r.db.Exec(
		`INSERT INTO word_tests (user_id, list, group_label, total, spelling_correct, meaning_correct, items)
		   VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userID, t.List, t.GroupLabel, t.Total, t.SpellingCorrect, t.MeaningCorrect, string(itemsJSON),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// GetTests returns the user's self-test history, newest first, each with its
// full per-word breakdown decoded from the stored JSON.
func (r *repository) GetTests(userID int64) ([]TestResult, error) {
	rows, err := r.db.Query(
		`SELECT id, list, group_label, total, spelling_correct, meaning_correct, items, created_at
		   FROM word_tests WHERE user_id = ?
		   ORDER BY created_at DESC, id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TestResult, 0)
	for rows.Next() {
		var t TestResult
		var itemsJSON string
		if err := rows.Scan(&t.ID, &t.List, &t.GroupLabel, &t.Total, &t.SpellingCorrect, &t.MeaningCorrect, &itemsJSON, &t.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(itemsJSON), &t.Items); err != nil {
			t.Items = []TestItem{}
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

// BulkAddWords inserts many bare words (no context, no image) tagged with the
// given list, in one transaction, skipping any the user already has so existing
// context isn't overwritten. Returns how many were newly added.
func (r *repository) BulkAddWords(userID int64, words []string, list string) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO words (user_id, word, list) VALUES (?, ?, ?) ON CONFLICT(user_id, word) DO NOTHING`,
	)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	added := 0
	for _, w := range words {
		res, err := stmt.Exec(userID, w, list)
		if err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			added++
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return added, nil
}

func (r *repository) RemoveWord(userID int64, word string) error {
	_, err := r.db.Exec(
		`DELETE FROM words WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}

// CompleteWord marks a word as learned, moving it out of the "added" list and
// into the completed list. Stamps the moment of completion for the progress chart.
func (r *repository) CompleteWord(userID int64, word string) error {
	_, err := r.db.Exec(
		`UPDATE words SET completed_at = datetime('now') WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}
