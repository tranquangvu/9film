package learning

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

// Bundled starter word lists the user can import in one tap, seeding a
// vocabulary to study. Vendored rather than fetched so the import works offline
// and can't shift under us; sourced from
// https://github.com/sapbmw/The-Oxford-3000 (The_Oxford_3000.txt).
//
//go:embed oxford3000.txt
var oxford3000List string

const dictAPIBase = "https://api.dictionaryapi.dev/api/v2/entries/en"

// Upstream free translation endpoint (no API key). Isolated here so the source
// can be swapped without touching handlers.
const translateAPIBase = "https://api.mymemory.translated.net/get"

const learningUserAgent = "NiceFilm/1.0"

// dictAPIResponse mirrors the upstream dictionaryapi.dev shape (only the fields
// we need). The endpoint returns an array of entries for a word.
type dictAPIResponse struct {
	Word      string `json:"word"`
	Phonetic  string `json:"phonetic"`
	Phonetics []struct {
		Text  string `json:"text"`
		Audio string `json:"audio"`
	} `json:"phonetics"`
	Meanings []struct {
		PartOfSpeech string `json:"partOfSpeech"`
		Definitions  []struct {
			Definition string `json:"definition"`
			Example    string `json:"example"`
		} `json:"definitions"`
	} `json:"meanings"`
}

type translateResponse struct {
	ResponseData struct {
		TranslatedText string `json:"translatedText"`
	} `json:"responseData"`
	ResponseStatus int `json:"responseStatus"`
}

// Service serves the language-learning helpers (dictionary lookups + machine
// translation), each over its own timeout-bounded HTTP client, plus the saved
// vocabulary word business logic (backed by the repository).
type Service interface {
	Define(word string) (*Definition, error)
	Translate(text, target string) (string, error)
	GetWords(userID int64, status, list string, limit, offset int) ([]Word, error)
	GetWordStats(userID int64) ([]WordStat, error)
	AddWord(userID int64, w Word) error
	// ImportWordList bulk-adds a bundled starter list (e.g. "oxford3000"),
	// returning how many words were newly added.
	ImportWordList(userID int64, list string) (int, error)
	RemoveWord(userID int64, word string) error
	CompleteWord(userID int64, word string) error
	// SubmitTest grades a completed self-test (spelling locally, meanings via AI
	// when configured, else a heuristic), stores it, and returns the result.
	SubmitTest(userID int64, list, groupLabel string, items []TestSubmissionItem) (*TestResult, error)
	// GetTests returns the user's self-test history, newest first.
	GetTests(userID int64) ([]TestResult, error)
	// GetDueReviews returns learned words due for spaced-repetition review.
	GetDueReviews(userID int64, limit int) ([]Word, error)
	// SubmitReview applies an SM-2 recall grade and reschedules the word.
	SubmitReview(userID int64, word, grade string) (*Word, error)
	// ExplainPhrase returns an AI breakdown of an idiom/phrasal verb (cached;
	// falls back to a plain translation when no Gemini key is configured).
	ExplainPhrase(userID int64, phrase, sentence, target string) (*PhraseExplanation, error)
}

// GeminiKeys resolves the Gemini API key + model for a user. An empty key means
// generation is off for that user. The .env fallback is applied by the
// composition root, so the service just trusts what it's given.
type GeminiKeys interface {
	Resolve(userID int64) (apiKey, model string)
}

type service struct {
	repo            Repository
	dictClient      *http.Client
	translateClient *http.Client
	gen             Generator
	keys            GeminiKeys
}

func NewService(repo Repository, gen Generator, keys GeminiKeys) Service {
	return &service{
		repo:            repo,
		dictClient:      &http.Client{Timeout: 8 * time.Second},
		translateClient: &http.Client{Timeout: 8 * time.Second},
		gen:             gen,
		keys:            keys,
	}
}

// Define looks up an English word on dictionaryapi.dev and flattens the result.
// Returns (nil, nil) when the word has no entry (upstream 404) so callers can
// still return a translation-only response.
func (s *service) Define(word string) (*Definition, error) {
	endpoint := dictAPIBase + "/" + url.PathEscape(word)
	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", learningUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := s.dictClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dictionary lookup: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("dictionary lookup failed (%d)", resp.StatusCode)
	}

	var entries []dictAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil || len(entries) == 0 {
		return nil, nil
	}

	out := &Definition{Word: word}
	for _, e := range entries {
		if out.Phonetic == "" && e.Phonetic != "" {
			out.Phonetic = e.Phonetic
		}
		for _, p := range e.Phonetics {
			if out.Phonetic == "" && p.Text != "" {
				out.Phonetic = p.Text
			}
			if out.AudioURL == "" && p.Audio != "" {
				out.AudioURL = p.Audio
			}
		}
		for _, m := range e.Meanings {
			meaning := Meaning{PartOfSpeech: m.PartOfSpeech}
			for _, d := range m.Definitions {
				meaning.Definitions = append(meaning.Definitions, DefinEntry{
					Definition: d.Definition,
					Example:    d.Example,
				})
			}
			out.Meanings = append(out.Meanings, meaning)
		}
	}
	return out, nil
}

// Translate renders English text into the target language (e.g. "vi"). It
// returns an empty string (no error) on empty input so the caller can still
// serve a dictionary-only response.
func (s *service) Translate(text, target string) (string, error) {
	if text == "" {
		return "", nil
	}
	if target == "" {
		target = "vi"
	}

	q := url.Values{}
	q.Set("q", text)
	q.Set("langpair", "en|"+target)
	endpoint := translateAPIBase + "?" + q.Encode()

	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", learningUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := s.translateClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("translate: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("translate failed (%d)", resp.StatusCode)
	}

	var result translateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.ResponseData.TranslatedText, nil
}

func (s *service) GetWords(userID int64, status, list string, limit, offset int) ([]Word, error) {
	return s.repo.GetWords(userID, status, list, limit, offset)
}

// ExplainPhrase generates an idiom/phrasal-verb breakdown with Gemini. With no
// key (or on AI failure) it degrades to a plain machine translation as the
// meaning. Results aren't persisted server-side; the frontend caches them.
func (s *service) ExplainPhrase(userID int64, phrase, sentence, target string) (*PhraseExplanation, error) {
	apiKey, model := s.keys.Resolve(userID)
	if apiKey == "" {
		meaning, _ := s.Translate(phrase, target)
		return &PhraseExplanation{Meaning: meaning}, nil
	}
	e, err := s.gen.ExplainPhrase(apiKey, model, phrase, sentence)
	if err != nil {
		logger.Get().Warn("phrase explanation failed; using translation", zap.String("phrase", phrase), zap.Error(err))
		meaning, _ := s.Translate(phrase, target)
		return &PhraseExplanation{Meaning: meaning}, nil
	}
	return e, nil
}

func (s *service) GetWordStats(userID int64) ([]WordStat, error) {
	return s.repo.GetWordStats(userID)
}

func (s *service) AddWord(userID int64, w Word) error {
	return s.repo.AddWord(userID, w)
}

func (s *service) ImportWordList(userID int64, list string) (int, error) {
	if list != "oxford3000" {
		return 0, fmt.Errorf("unknown word list %q", list)
	}
	return s.repo.BulkAddWords(userID, parseWordList(oxford3000List), "oxford3000")
}

// parseWordList turns a newline-separated list into trimmed, lowercased, unique
// words. It strips a leading UTF-8 BOM and skips blanks, over-long lines, and
// marker lines (e.g. the source's trailing "=== end ==") so junk can't be
// inserted as vocabulary. Multi-word phrases (e.g. "according to") are kept —
// they're legitimate Oxford entries.
func parseWordList(text string) []string {
	text = strings.TrimPrefix(text, "\ufeff") // strip a UTF-8 BOM if present
	seen := make(map[string]struct{})
	out := make([]string, 0)
	for _, line := range strings.Split(text, "\n") {
		w := strings.ToLower(strings.TrimSpace(line))
		if w == "" || len(w) > 64 || strings.Contains(w, "=") {
			continue
		}
		if _, dup := seen[w]; dup {
			continue
		}
		seen[w] = struct{}{}
		out = append(out, w)
	}
	return out
}

func (s *service) RemoveWord(userID int64, word string) error {
	return s.repo.RemoveWord(userID, word)
}

func (s *service) CompleteWord(userID int64, word string) error {
	return s.repo.CompleteWord(userID, word)
}

// SubmitTest grades a completed self-test and persists it. Spelling is scored
// locally (each retyped attempt vs the word); meanings are graded by Gemini in a
// single batch call when the user has a key, otherwise by a string heuristic
// against the saved translation so the feature still works fully offline.
func (s *service) SubmitTest(userID int64, list, groupLabel string, in []TestSubmissionItem) (*TestResult, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("no test items")
	}

	items := make([]TestItem, 0, len(in))
	checks := make([]MeaningCheck, 0, len(in))
	for _, it := range in {
		word := strings.ToLower(strings.TrimSpace(it.Word))
		if word == "" {
			continue
		}
		spellings := make([]string, 0, len(it.Spellings))
		score := 0
		for _, raw := range it.Spellings {
			attempt := strings.TrimSpace(raw)
			spellings = append(spellings, attempt)
			if strings.EqualFold(attempt, word) {
				score++
			}
		}
		// The saved translation is the grading reference for the meaning answer.
		translation := ""
		if w, _ := s.repo.GetWord(userID, word); w != nil {
			translation = w.Translation
		}
		meaning := strings.TrimSpace(it.Meaning)
		items = append(items, TestItem{
			Word:          word,
			Spellings:     spellings,
			SpellingScore: score,
			Meaning:       meaning,
			Translation:   translation,
		})
		checks = append(checks, MeaningCheck{Word: word, Translation: translation, Answer: meaning})
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no valid test items")
	}

	// Grade the meanings: AI when configured, heuristic otherwise/on failure.
	apiKey, model := s.keys.Resolve(userID)
	if apiKey != "" {
		if verdicts, err := s.gen.VerifyMeanings(apiKey, model, checks); err != nil {
			logger.Get().Warn("meaning verification failed; using offline check", zap.Error(err))
			applyFallbackVerdicts(items)
		} else {
			applyVerdicts(items, verdicts)
		}
	} else {
		applyFallbackVerdicts(items)
	}

	result := TestResult{List: list, GroupLabel: groupLabel, Total: len(items), Items: items}
	for _, it := range items {
		if len(it.Spellings) > 0 && it.SpellingScore == len(it.Spellings) {
			result.SpellingCorrect++
		}
		if it.MeaningCorrect {
			result.MeaningCorrect++
		}
	}

	id, err := s.repo.SaveTest(userID, result)
	if err != nil {
		return nil, err
	}
	result.ID = id
	// Mirror SQLite's datetime('now') format so the immediate return matches what
	// a later GetTests read would show.
	result.CreatedAt = time.Now().UTC().Format("2006-01-02 15:04:05")
	return &result, nil
}

func (s *service) GetTests(userID int64) ([]TestResult, error) {
	return s.repo.GetTests(userID)
}

// applyVerdicts folds AI judgements back onto the items by word, falling back to
// the heuristic for any item the model omitted.
func applyVerdicts(items []TestItem, verdicts []MeaningVerdict) {
	byWord := make(map[string]MeaningVerdict, len(verdicts))
	for _, v := range verdicts {
		byWord[strings.ToLower(strings.TrimSpace(v.Word))] = v
	}
	for i := range items {
		if v, ok := byWord[items[i].Word]; ok {
			items[i].MeaningCorrect = v.Correct
			items[i].Feedback = strings.TrimSpace(v.Feedback)
		} else {
			items[i].MeaningCorrect, items[i].Feedback = heuristicVerdict(items[i].Translation, items[i].Meaning)
		}
	}
}

func applyFallbackVerdicts(items []TestItem) {
	for i := range items {
		items[i].MeaningCorrect, items[i].Feedback = heuristicVerdict(items[i].Translation, items[i].Meaning)
	}
}

// heuristicVerdict grades a meaning answer without AI: a non-empty answer that
// overlaps the saved translation passes; with no reference we accept it but note
// it wasn't verified, so an offline user is never unfairly marked wrong.
func heuristicVerdict(translation, answer string) (bool, string) {
	a := strings.ToLower(strings.TrimSpace(answer))
	if a == "" {
		return false, "No answer given."
	}
	t := strings.ToLower(strings.TrimSpace(translation))
	if t == "" {
		return true, "Saved (no AI check available)."
	}
	if strings.Contains(t, a) || strings.Contains(a, t) {
		return true, "Matches your saved meaning."
	}
	return false, "Expected something like: " + translation
}
