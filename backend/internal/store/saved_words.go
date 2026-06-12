package store

import "strconv"

type SavedWord struct {
	Word        string  `json:"word"`
	Sentence    string  `json:"sentence"`
	Translation string  `json:"translation"`
	ImdbID      string  `json:"imdbId"`
	Season      int     `json:"season"`
	Episode     int     `json:"episode"`
	Timestamp   float64 `json:"timestamp"`
	Box         int     `json:"box"`
	DueAt       string  `json:"dueAt"`
	CreatedAt   string  `json:"createdAt"`
}

// GetSavedWords returns all of a user's saved words, soonest-due first so the
// review page can drill them in order.
func (s *Store) GetSavedWords(userID int64) ([]SavedWord, error) {
	rows, err := s.db.Query(
		`SELECT word, sentence, translation, imdb_id, season, episode, timestamp, box, due_at, created_at
		   FROM saved_words WHERE user_id = ?
		   ORDER BY due_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SavedWord, 0)
	for rows.Next() {
		var w SavedWord
		if err := rows.Scan(
			&w.Word, &w.Sentence, &w.Translation, &w.ImdbID,
			&w.Season, &w.Episode, &w.Timestamp, &w.Box, &w.DueAt, &w.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	return items, rows.Err()
}

// AddSavedWord upserts a word (idempotent on the user_id+word PK). Re-saving a
// word refreshes its context/scene but preserves nothing of its SRS schedule —
// it resets to a freshly-learned card due now.
func (s *Store) AddSavedWord(userID int64, w SavedWord) error {
	_, err := s.db.Exec(
		`INSERT INTO saved_words
		   (user_id, word, sentence, translation, imdb_id, season, episode, timestamp, box, due_at)
		   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
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

func (s *Store) RemoveSavedWord(userID int64, word string) error {
	_, err := s.db.Exec(
		`DELETE FROM saved_words WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}

// ReviewWord updates the spaced-repetition schedule for a word after a review.
// The next due date is computed as now + intervalDays so it stays consistent
// with SQLite's clock regardless of the client's timezone.
func (s *Store) ReviewWord(userID int64, word string, box, intervalDays int) error {
	modifier := "+" + strconv.Itoa(intervalDays) + " days"
	_, err := s.db.Exec(
		`UPDATE saved_words SET box = ?, due_at = datetime('now', ?) WHERE user_id = ? AND word = ?`,
		box, modifier, userID, word,
	)
	return err
}
