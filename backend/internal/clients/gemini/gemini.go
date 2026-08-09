// Package gemini is a client for Google's Gemini generateContent API.
//
// It carries no prompts and no knowledge of what the app asks for: callers pass
// the prompt and get the reply, or hand in a destination and get the JSON out of
// that reply unmarshalled into it. The prompts live with the feature that owns
// them, in modules/learning.
package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// DefaultModel is used whenever a caller passes an empty model.
const DefaultModel = "gemini-2.5-flash"

type Client struct {
	http *http.Client
	base string
}

func New() *Client {
	return &Client{
		http: &http.Client{Timeout: 30 * time.Second},
		base: "https://generativelanguage.googleapis.com/v1beta/models",
	}
}

// Generate runs a single-turn prompt and returns the reply as text, with every
// candidate part concatenated.
func (c *Client) Generate(apiKey, model, prompt string) (string, error) {
	if model == "" {
		model = DefaultModel
	}

	payload, err := json.Marshal(request{
		Contents: []content{{Parts: []part{{Text: prompt}}}},
	})
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/%s:generateContent", c.base, model)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(resp.Body)
		return "", fmt.Errorf("gemini returned %d: %s", resp.StatusCode, strings.TrimSpace(buf.String()))
	}

	var result response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode gemini response: %w", err)
	}

	var text strings.Builder
	for _, cand := range result.Candidates {
		for _, p := range cand.Content.Parts {
			text.WriteString(p.Text)
		}
	}
	return text.String(), nil
}

// GenerateJSONArray runs a prompt whose reply is meant to be a JSON array and
// unmarshals it into dest. Models wrap their answers in prose or code fences
// however they like, so the outermost [...] is taken rather than the whole reply.
func (c *Client) GenerateJSONArray(apiKey, model, prompt string, dest any) error {
	return c.generateJSON(apiKey, model, prompt, dest, "array", '[', ']')
}

// GenerateJSONObject is GenerateJSONArray for a reply meant to be a single JSON
// object.
func (c *Client) GenerateJSONObject(apiKey, model, prompt string, dest any) error {
	return c.generateJSON(apiKey, model, prompt, dest, "object", '{', '}')
}

func (c *Client) generateJSON(apiKey, model, prompt string, dest any, kind string, first, last byte) error {
	text, err := c.Generate(apiKey, model, prompt)
	if err != nil {
		return err
	}
	raw, ok := extractJSON(text, first, last)
	if !ok {
		return fmt.Errorf("gemini response contained no json %s", kind)
	}
	if err := json.Unmarshal([]byte(raw), dest); err != nil {
		return fmt.Errorf("parse gemini %s: %w", kind, err)
	}
	return nil
}

// extractJSON pulls the outermost first…last span out of a model reply that may
// have prose or code fences around it.
func extractJSON(text string, first, last byte) (string, bool) {
	lo := strings.IndexByte(text, first)
	hi := strings.LastIndexByte(text, last)
	if lo < 0 || hi < 0 || hi < lo {
		return "", false
	}
	return text[lo : hi+1], true
}

// --- request / response shapes ---

type request struct {
	Contents []content `json:"contents"`
}

type content struct {
	Parts []part `json:"parts"`
}

type part struct {
	Text string `json:"text,omitempty"`
}

type response struct {
	Candidates []struct {
		Content content `json:"content"`
	} `json:"candidates"`
}
