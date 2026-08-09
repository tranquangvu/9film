package subtitle

import (
	"fmt"
	"io"
	"net/http"
	"strings"
)

const userAgent = "NiceFilm/1.0"

func applyHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header.Set(k, v)
	}
}

// fetchBytes GETs a URL and returns the body, capped at maxDownloadBytes. Both
// providers signal exhaustion the same way — 429 is a rate limit, 406 is a spent
// daily download quota — so both map to ErrRateLimited here.
func fetchBytes(client *http.Client, rawURL string, headers map[string]string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	applyHeaders(req, headers)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", rawURL, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxDownloadBytes))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusNotAcceptable {
			return nil, fmt.Errorf("%w: %s", ErrRateLimited, strings.TrimSpace(string(body)))
		}
		return nil, fmt.Errorf("request failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}
