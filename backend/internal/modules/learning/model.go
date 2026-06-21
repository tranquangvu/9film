package learning

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
	// AI illustration state: ''=none/legacy, pending, ready, failed. The image
	// bytes live in the word_images table; ImageUpdatedAt is a cache-bust token.
	ImageStatus    string `json:"imageStatus"`
	ImageUpdatedAt string `json:"imageUpdatedAt"`
	// Which list the word belongs to: ''=personal (saved while watching),
	// 'oxford3000'=imported starter pack.
	List string `json:"list"`
	// Spaced-repetition (SM-2) schedule. DueAt=''=not scheduled (seeded on first
	// completion); Ease starts at 2.5; Interval is in days; Reps is the streak.
	DueAt    string  `json:"dueAt"`
	Ease     float64 `json:"ease"`
	Interval int     `json:"interval"`
	Reps     int     `json:"reps"`
	// Capture kind: 'word' (default) or 'phrase' (a multi-word idiom/phrasal verb).
	Kind string `json:"kind"`
}

// PhraseExplanation is the AI breakdown of a saved phrase/idiom.
type PhraseExplanation struct {
	Meaning    string `json:"meaning"`
	Literal    string `json:"literal"`
	Figurative string `json:"figurative"`
	Usage      string `json:"usage"`
}

// WordStat is a saved word stripped to the fields the learning page's progress
// chart, header counts, and "is this word already saved?" lookups need. Omitting
// the heavy sentence/translation/scene fields keeps the full set cheap to load
// even while the rendered list itself is paginated.
type WordStat struct {
	Word        string `json:"word"`
	CreatedAt   string `json:"createdAt"`
	CompletedAt string `json:"completedAt"`
	List        string `json:"list"`
	// Next SRS review time ('' when not scheduled) — lets the page derive the
	// "due for review today" count from the cheap stats set, no extra query.
	DueAt string `json:"dueAt"`
	// 'word' or 'phrase' — so the lists can badge/skip phrases without full rows.
	Kind string `json:"kind"`
}

// TestSubmissionItem is one word's raw answers as submitted by the client: the
// spelling attempts (the word is hidden, then retyped N times) and the learner's
// stated meaning (free text, any language). Graded server-side.
type TestSubmissionItem struct {
	Word      string
	Spellings []string
	Meaning   string
}

// TestItem is one graded word in a stored test result.
type TestItem struct {
	Word string `json:"word"`
	// The retyped spelling attempts, in order.
	Spellings []string `json:"spellings"`
	// How many attempts exactly matched the word (0..len(Spellings)).
	SpellingScore int `json:"spellingScore"`
	// The learner's stated meaning and the AI/heuristic verdict on it.
	Meaning        string `json:"meaning"`
	MeaningCorrect bool   `json:"meaningCorrect"`
	Feedback       string `json:"feedback"`
	// The saved translation used as the grading reference (may be empty).
	Translation string `json:"translation"`
}

// TestResult is a completed self-test over a completed-date word group.
type TestResult struct {
	ID         int64  `json:"id"`
	List       string `json:"list"`
	GroupLabel string `json:"groupLabel"`
	Total      int    `json:"total"`
	// Words spelled perfectly (every attempt correct) and meanings judged correct.
	SpellingCorrect int        `json:"spellingCorrect"`
	MeaningCorrect  int        `json:"meaningCorrect"`
	Items           []TestItem `json:"items"`
	CreatedAt       string     `json:"createdAt"`
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
