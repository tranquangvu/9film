package store

type Word struct {
	Word        string  `json:"word"`
	Sentence    string  `json:"sentence"`
	Translation string  `json:"translation"`
	ImdbID      string  `json:"imdbId"`
	Season      int     `json:"season"`
	Episode     int     `json:"episode"`
	Timestamp   float64 `json:"timestamp"`
	CreatedAt   string  `json:"createdAt"`
	CompletedAt string  `json:"completedAt"`
}

// GetWords returns all of a user's saved words, most-recently-added first so the
// learning page can group them by added date.
func (s *Store) GetWords(userID int64) ([]Word, error) {
	rows, err := s.db.Query(
		`SELECT word, sentence, translation, imdb_id, season, episode, timestamp, created_at, completed_at
		   FROM words WHERE user_id = ?
		   ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Word, 0)
	for rows.Next() {
		var w Word
		if err := rows.Scan(
			&w.Word, &w.Sentence, &w.Translation, &w.ImdbID,
			&w.Season, &w.Episode, &w.Timestamp, &w.CreatedAt, &w.CompletedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	return items, rows.Err()
}

// AddWord upserts a word (idempotent on the user_id+word PK). Re-saving a word
// refreshes its context/scene but leaves its completed state untouched.
func (s *Store) AddWord(userID int64, w Word) error {
	_, err := s.db.Exec(
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

func (s *Store) RemoveWord(userID int64, word string) error {
	_, err := s.db.Exec(
		`DELETE FROM words WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}

// CompleteWord marks a word as learned, moving it out of the "added" list and
// into the completed list. Stamps the moment of completion for the progress chart.
func (s *Store) CompleteWord(userID int64, word string) error {
	_, err := s.db.Exec(
		`UPDATE words SET completed_at = datetime('now') WHERE user_id = ? AND word = ?`,
		userID, word,
	)
	return err
}
