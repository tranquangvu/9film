package learning

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const geminiAPIBase = "https://generativelanguage.googleapis.com/v1beta/models"
const defaultGeminiModel = "gemini-2.5-flash"

// Generator is the Gemini-backed helper: it produces an AI "memory image"
// illustration (SVG markup) for a vocabulary word and grades self-test meaning
// answers — both using the API key + model resolved per user.
type Generator interface {
	GenerateWordImage(apiKey, model, word, translation, sentence string) ([]byte, error)
	// VerifyMeanings grades a batch of meaning answers in one call, returning a
	// verdict per item (order/word-matched by the caller).
	VerifyMeanings(apiKey, model string, items []MeaningCheck) ([]MeaningVerdict, error)
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

type geminiGenerator struct {
	client *http.Client
}

func NewGenerator() Generator {
	return &geminiGenerator{client: &http.Client{Timeout: 30 * time.Second}}
}

// svgPrompt asks a text model to draw the word as a self-contained, script-free
// SVG so it can be stored cheaply and scaled crisply. It forbids text in the art
// (the image is a pure visual mnemonic).
func svgPrompt(word, translation, sentence string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Create a single self-contained SVG illustration that helps memorize the English word %q", word)
	if t := strings.TrimSpace(translation); t != "" {
		fmt.Fprintf(&b, " (meaning: %s)", t)
	}
	b.WriteString(". ")
	if s := strings.TrimSpace(sentence); s != "" {
		fmt.Fprintf(&b, "Context: %q. ", s)
	}
	b.WriteString(`Style: flat vector cartoon, cute and playful, a bright but limited color palette, soft rounded shapes, one clear centered subject, viewBox="0 0 512 512". ` +
		`Do NOT include any <text> elements, words, letters, or numbers. Do NOT include <script>, event handlers, <foreignObject>, external images, or links. ` +
		`Output ONLY the raw SVG markup, starting with <svg and ending with </svg>, with no explanation and no code fences.`)
	return b.String()
}

func (g *geminiGenerator) GenerateWordImage(apiKey, model, word, translation, sentence string) ([]byte, error) {
	if model == "" {
		model = defaultGeminiModel
	}
	reqBody := geminiRequest{
		Contents: []geminiContent{{
			Parts: []geminiPart{{Text: svgPrompt(word, translation, sentence)}},
		}},
	}
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s:generateContent", geminiAPIBase, model)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(resp.Body)
		return nil, fmt.Errorf("gemini returned %d: %s", resp.StatusCode, strings.TrimSpace(buf.String()))
	}

	var result geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode gemini response: %w", err)
	}

	var text strings.Builder
	for _, cand := range result.Candidates {
		for _, part := range cand.Content.Parts {
			text.WriteString(part.Text)
		}
	}
	svg, ok := extractSVG(text.String())
	if !ok {
		return nil, fmt.Errorf("gemini response contained no svg")
	}
	return []byte(sanitizeSVG(svg)), nil
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

func (g *geminiGenerator) VerifyMeanings(apiKey, model string, items []MeaningCheck) ([]MeaningVerdict, error) {
	if model == "" {
		model = defaultGeminiModel
	}
	reqBody := geminiRequest{
		Contents: []geminiContent{{
			Parts: []geminiPart{{Text: meaningPrompt(items)}},
		}},
	}
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s:generateContent", geminiAPIBase, model)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(resp.Body)
		return nil, fmt.Errorf("gemini returned %d: %s", resp.StatusCode, strings.TrimSpace(buf.String()))
	}

	var result geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode gemini response: %w", err)
	}

	var text strings.Builder
	for _, cand := range result.Candidates {
		for _, part := range cand.Content.Parts {
			text.WriteString(part.Text)
		}
	}
	raw, ok := extractJSONArray(text.String())
	if !ok {
		return nil, fmt.Errorf("gemini response contained no json array")
	}
	var verdicts []MeaningVerdict
	if err := json.Unmarshal([]byte(raw), &verdicts); err != nil {
		return nil, fmt.Errorf("parse verdicts: %w", err)
	}
	return verdicts, nil
}

// extractJSONArray pulls the [...] array out of a model reply that may include
// prose or code fences around it.
func extractJSONArray(text string) (string, bool) {
	lo := strings.Index(text, "[")
	hi := strings.LastIndex(text, "]")
	if lo < 0 || hi < 0 || hi < lo {
		return "", false
	}
	return text[lo : hi+1], true
}

// extractSVG pulls the <svg>…</svg> element out of a model reply that may include
// prose or code fences around it.
func extractSVG(text string) (string, bool) {
	lo := strings.Index(text, "<svg")
	hi := strings.LastIndex(text, "</svg>")
	if lo < 0 || hi < 0 || hi < lo {
		return "", false
	}
	return text[lo : hi+len("</svg>")], true
}

// SVG sanitization: defense-in-depth on top of rendering via <img> (which already
// disables scripting). Strips active content so a stored SVG can't run code.
var (
	svgScriptRe  = regexp.MustCompile(`(?is)<script.*?</script>`)
	svgForeignRe = regexp.MustCompile(`(?is)<foreignObject.*?</foreignObject>`)
	svgOnAttrRe  = regexp.MustCompile(`(?i)\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
	svgJSHrefRe  = regexp.MustCompile(`(?i)(xlink:href|href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')`)
)

func sanitizeSVG(svg string) string {
	svg = svgScriptRe.ReplaceAllString(svg, "")
	svg = svgForeignRe.ReplaceAllString(svg, "")
	svg = svgOnAttrRe.ReplaceAllString(svg, "")
	svg = svgJSHrefRe.ReplaceAllString(svg, "")
	return svg
}

// --- request / response shapes ---

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
}
