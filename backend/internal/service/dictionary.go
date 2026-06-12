package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const dictAPIBase = "https://api.dictionaryapi.dev/api/v2/entries/en"

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

var dictClient = &http.Client{Timeout: 8 * time.Second}

// Define looks up an English word on dictionaryapi.dev and flattens the result.
// Returns (nil, nil) when the word has no entry (upstream 404) so callers can
// still return a translation-only response.
func Define(word string) (*Definition, error) {
	endpoint := dictAPIBase + "/" + url.PathEscape(word)
	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", openSubsUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := dictClient.Do(req)
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
