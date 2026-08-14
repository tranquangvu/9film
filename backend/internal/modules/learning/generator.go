package learning

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/bentran/9film/backend/internal/clients/gemini"
)

// Generator is the AI-backed helper: it grades self-test meaning answers and
// explains saved phrases/idioms — both using the API key + model resolved per
// user.
//
// The prompts live here rather than in clients/gemini: what to ask and how to
// read the answer is this feature's business, and the client underneath only
// knows how to run a prompt.
type Generator interface {
	// VerifyMeanings grades a batch of meaning answers in one call, returning a
	// verdict per item (order/word-matched by the caller).
	VerifyMeanings(apiKey, model string, items []MeaningCheck) ([]MeaningVerdict, error)
	// ExplainPhrase breaks down a saved idiom/phrasal verb (meaning, literal vs
	// figurative, usage), using the sentence it was captured from as context.
	ExplainPhrase(apiKey, model, phrase, sentence string) (*PhraseExplanation, error)
}

// MeaningCheck is one word's grading input: the word, an optional reference
// meaning (the saved translation), and the learner's answer.
type MeaningCheck struct {
	Word        string
	Translation string
	Answer      string
}

// MeaningVerdict is the model's judgement of a single answer.
type MeaningVerdict struct {
	Word     string `json:"word"`
	Correct  bool   `json:"correct"`
	Feedback string `json:"feedback"`
}

// llm is the slice of the Gemini client this package uses, named here so the
// generator can be tested against a stub instead of the network.
type llm interface {
	GenerateJSONArray(apiKey, model, prompt string, dest any) error
	GenerateJSONObject(apiKey, model, prompt string, dest any) error
}

type generator struct{ client llm }

func NewGenerator() Generator { return &generator{client: gemini.New()} }

func (g *generator) VerifyMeanings(apiKey, model string, items []MeaningCheck) ([]MeaningVerdict, error) {
	var verdicts []MeaningVerdict
	if err := g.client.GenerateJSONArray(apiKey, model, meaningPrompt(items), &verdicts); err != nil {
		return nil, err
	}
	return verdicts, nil
}

func (g *generator) ExplainPhrase(apiKey, model, phrase, sentence string) (*PhraseExplanation, error) {
	var e PhraseExplanation
	if err := g.client.GenerateJSONObject(apiKey, model, phrasePrompt(phrase, sentence), &e); err != nil {
		return nil, err
	}
	return &e, nil
}

// meaningPrompt asks the model to grade every answer at once and reply with a
// strict JSON array so the result parses deterministically.
func meaningPrompt(items []MeaningCheck) string {
	type p struct {
		Word      string `json:"word"`
		Reference string `json:"reference,omitempty"`
		Answer    string `json:"answer"`
	}
	arr := make([]p, len(items))
	for i, it := range items {
		arr[i] = p{Word: it.Word, Reference: it.Translation, Answer: it.Answer}
	}
	data, _ := json.Marshal(arr)

	var b strings.Builder
	b.WriteString("You are grading a vocabulary quiz. Each item has an English \"word\", an optional \"reference\" meaning/translation, and the learner's \"answer\" describing what they think the word means. ")
	b.WriteString("Decide whether the answer correctly captures the word's meaning. Accept synonyms, paraphrases, and answers in any language (including Vietnamese). Be lenient about spelling and phrasing, but mark empty or clearly wrong answers as incorrect. ")
	b.WriteString("Return ONLY a JSON array with one object per item, in the same order, shaped exactly like {\"word\": string, \"correct\": boolean, \"feedback\": string}. ")
	b.WriteString("Keep feedback under 14 words and encouraging; if incorrect, briefly give the correct meaning. No markdown, no code fences.\n")
	b.WriteString("Items: ")
	b.Write(data)
	return b.String()
}

// phrasePrompt asks the model to explain an idiom/phrasal verb as one strict JSON
// object so the result parses deterministically.
func phrasePrompt(phrase, sentence string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Explain the English phrase %q for a language learner. ", phrase)
	if s := strings.TrimSpace(sentence); s != "" {
		fmt.Fprintf(&b, "It was used in this line: %q. ", s)
	}
	b.WriteString("Return ONLY a JSON object shaped exactly like ")
	b.WriteString(`{"meaning": string, "literal": string, "figurative": string, "usage": string}. `)
	b.WriteString(`"meaning" = the plain everyday meaning; "literal" = what the words say word-for-word; `)
	b.WriteString(`"figurative" = the idiomatic/figurative sense (empty string if it is not figurative); `)
	b.WriteString(`"usage" = a short note on when/how it's used, with one fresh example. `)
	b.WriteString("Keep each field under 30 words. No markdown, no code fences.")
	return b.String()
}
