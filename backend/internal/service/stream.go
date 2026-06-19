package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const streamAPIURL = "https://streamdata.vaplayer.ru/api.php"

type StreamResult struct {
	Body        []byte
	Status      int
	ContentType string
}

// Stream proxies the upstream stream-resolution API.
type Stream struct {
	client *http.Client
}

func NewStream() *Stream {
	return &Stream{client: http.DefaultClient}
}

func (s *Stream) ProxyStreamRequest(rawQuery string) (*StreamResult, error) {
	target, err := url.Parse(streamAPIURL)
	if err != nil {
		return nil, err
	}

	incoming, err := url.ParseQuery(rawQuery)
	if err != nil {
		return nil, fmt.Errorf("invalid query string: %w", err)
	}
	target.RawQuery = incoming.Encode()

	req, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", embedReferer)
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stream API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read stream response: %w", err)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/json"
	}

	// The upstream PHP endpoint occasionally prepends HTML warnings/notices
	// (e.g. "<br /> <b>Warning</b>: ... on line <b>123</b>") before the JSON
	// payload, which makes the browser's JSON.parse choke on a leading '<'.
	// Recover the JSON object so callers always receive parseable data.
	if cleaned, ok := extractJSON(body); ok {
		body = cleaned
		ct = "application/json"
	}

	return &StreamResult{
		Body:        body,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}

// extractJSON pulls the outermost JSON object out of a response body that may be
// polluted with leading or trailing non-JSON content (such as PHP warnings). It
// returns the cleaned slice and whether any cleaning was applied.
func extractJSON(body []byte) ([]byte, bool) {
	if len(bytes.TrimSpace(body)) == 0 {
		return body, false
	}
	// Already clean JSON — leave it untouched.
	if b := bytes.TrimSpace(body); b[0] == '{' || b[0] == '[' {
		return body, false
	}
	start := bytes.IndexByte(body, '{')
	end := bytes.LastIndexByte(body, '}')
	if start < 0 || end <= start {
		return body, false
	}
	return body[start : end+1], true
}
