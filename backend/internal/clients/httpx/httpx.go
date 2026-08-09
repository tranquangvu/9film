// Package httpx holds the small HTTP helpers the sibling vendor clients share,
// so that isolating each vendor into its own package doesn't mean copying the
// same bounded GET three times.
//
// It lives under clients/ because that is its whole audience: nothing outside
// this tree imports it. Each client restates ErrRateLimited as its own sentinel
// (subdl.ErrRateLimited, opensubtitles.ErrRateLimited) so the modules above
// match on vendor vocabulary and never reach in here.
package httpx

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ErrRateLimited is returned when an upstream rejects a request because the
// account hit its rate limit or spent its quota. Callers wrap it in whatever
// their own domain calls that condition.
var ErrRateLimited = errors.New("upstream rate limit reached or quota exhausted")

func ApplyHeaders(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header.Set(k, v)
	}
}

// GetBytes GETs a URL and returns the body, reading at most limit bytes so a
// wrong or hostile URL can't stream an unbounded response into memory.
//
// 429 and 406 both map to ErrRateLimited: 429 is the ordinary rate limit and
// 406 is how OpenSubtitles reports a spent daily download quota.
func GetBytes(client *http.Client, rawURL string, headers map[string]string, limit int64) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	ApplyHeaders(req, headers)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", rawURL, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, limit))
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
