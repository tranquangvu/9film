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

// Generator produces an AI "memory image" illustration (SVG markup) for a
// vocabulary word, using the API key + model resolved per user.
type Generator interface {
	GenerateWordImage(apiKey, model, word, translation, sentence string) ([]byte, error)
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
