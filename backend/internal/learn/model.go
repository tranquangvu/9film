package learn

// Word is a saved vocabulary entry with its capture context (the sentence/scene
// it was learned from).
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

// WordStat is a saved word stripped to the fields the learning page's progress
// chart, header counts, and "is this word already saved?" lookups need. Omitting
// the heavy sentence/translation/scene fields keeps the full set cheap to load
// even while the rendered list itself is paginated.
type WordStat struct {
	Word        string `json:"word"`
	CreatedAt   string `json:"createdAt"`
	CompletedAt string `json:"completedAt"`
}

// Definition is the flattened shape the frontend consumes for a single word.
type Definition struct {
	Word     string    `json:"word"`
	Phonetic string    `json:"phonetic"`
	AudioURL string    `json:"audioUrl"`
	Meanings []Meaning `json:"meanings"`
}

type Meaning struct {
	PartOfSpeech string       `json:"partOfSpeech"`
	Definitions  []DefinEntry `json:"definitions"`
}

type DefinEntry struct {
	Definition string `json:"definition"`
	Example    string `json:"example"`
}
