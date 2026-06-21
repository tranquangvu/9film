package learning

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

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
	GetWords(userID int64, status string, limit, offset int) ([]Word, error)
	GetWordStats(userID int64) ([]WordStat, error)
	AddWord(userID int64, w Word) error
	RemoveWord(userID int64, word string) error
	CompleteWord(userID int64, word string) error
	// ImageEnabled reports whether AI illustrations are configured.
	ImageEnabled() bool
	// RegenerateWordImage (re)generates the illustration for an existing word —
	// backfills legacy words and retries failures.
	RegenerateWordImage(userID int64, word string) error
	// WordImage returns a word's stored PNG bytes, or (nil, false) when none.
	WordImage(userID int64, word string) ([]byte, bool)
}

// maxConcurrentImageGen bounds in-flight Gemini calls across all background
// goroutines so a burst of saves can't fan out to dozens of slow requests.
const maxConcurrentImageGen = 3

type service struct {
	repo            Repository
	dictClient      *http.Client
	translateClient *http.Client
	gen             Generator
	imgSem          chan struct{}
}

func NewService(repo Repository, gen Generator) Service {
	return &service{
		repo:            repo,
		dictClient:      &http.Client{Timeout: 8 * time.Second},
		translateClient: &http.Client{Timeout: 8 * time.Second},
		gen:             gen,
		imgSem:          make(chan struct{}, maxConcurrentImageGen),
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

func (s *service) GetWords(userID int64, status string, limit, offset int) ([]Word, error) {
	return s.repo.GetWords(userID, status, limit, offset)
}

func (s *service) GetWordStats(userID int64) ([]WordStat, error) {
	return s.repo.GetWordStats(userID)
}

func (s *service) AddWord(userID int64, w Word) error {
	// Look up any prior state before the upsert so we only (re)generate for a new
	// word or one that never got an image — re-saving keeps the existing one.
	prior, _ := s.repo.GetWord(userID, w.Word)
	if err := s.repo.AddWord(userID, w); err != nil {
		return err
	}
	if prior == nil || prior.ImageStatus == "" || prior.ImageStatus == "failed" {
		s.generateAsync(userID, w.Word, w.Translation, w.Sentence)
	}
	return nil
}

func (s *service) RemoveWord(userID int64, word string) error {
	return s.repo.RemoveWord(userID, word)
}

func (s *service) CompleteWord(userID int64, word string) error {
	return s.repo.CompleteWord(userID, word)
}

func (s *service) ImageEnabled() bool { return s.gen.Configured() }

func (s *service) WordImage(userID int64, word string) ([]byte, bool) {
	return s.repo.GetImage(userID, word)
}

// RegenerateWordImage marks an existing word pending and kicks off generation
// again — used to backfill legacy words and retry failures on demand.
func (s *service) RegenerateWordImage(userID int64, word string) error {
	if !s.gen.Configured() {
		return fmt.Errorf("gemini not configured")
	}
	w, err := s.repo.GetWord(userID, word)
	if err != nil {
		return err
	}
	if w == nil {
		return fmt.Errorf("word not found")
	}
	s.generateAsync(userID, w.Word, w.Translation, w.Sentence)
	return nil
}

// generateAsync marks the word pending and fires a bounded background goroutine
// that calls Gemini and persists the result. The slow API call holds no DB
// connection; only the tiny status/blob writes touch the (single-connection)
// DB. No-op when unconfigured.
func (s *service) generateAsync(userID int64, word, translation, sentence string) {
	if !s.gen.Configured() {
		return
	}
	// Synchronous so an immediate refetch already sees the shimmer state.
	_ = s.repo.SetImageStatus(userID, word, "pending")
	go func() {
		s.imgSem <- struct{}{}
		defer func() { <-s.imgSem }()

		png, err := s.gen.GenerateWordImage(word, translation, sentence)
		if err != nil {
			logger.Get().Warn("word image generation failed", zap.String("word", word), zap.Error(err))
			_ = s.repo.SetImageStatus(userID, word, "failed")
			return
		}
		if err := s.repo.SaveImage(userID, word, png); err != nil {
			logger.Get().Warn("word image save failed", zap.String("word", word), zap.Error(err))
			_ = s.repo.SetImageStatus(userID, word, "failed")
		}
	}()
}
