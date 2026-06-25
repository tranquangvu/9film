package learning

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

const openverseAPIBase = "https://api.openverse.org/v1/images/"

// ImageSource finds a relevant, freely-licensed illustration for a vocabulary
// word. Isolated behind an interface so the upstream (currently Openverse) can be
// swapped without touching the service.
type ImageSource interface {
	// FetchWordImage returns a usable image URL for the query word, or an error
	// when nothing suitable is found.
	FetchWordImage(query string) (string, error)
}

type openverseSource struct {
	client *http.Client
}

func NewImageSource() ImageSource {
	return &openverseSource{client: &http.Client{Timeout: 8 * time.Second}}
}

type openverseResponse struct {
	Results []struct {
		URL       string `json:"url"`
		Thumbnail string `json:"thumbnail"`
	} `json:"results"`
}

// FetchWordImage queries Openverse for a commercially-licensed, safe-search image
// and returns the first result's thumbnail (a resized, embeddable URL), falling
// back to the full URL. Keyless: anonymous requests are rate-limited, but each
// word is fetched once and cached, so volume stays low.
func (s *openverseSource) FetchWordImage(query string) (string, error) {
	q := url.Values{}
	q.Set("q", query)
	q.Set("license_type", "commercial")
	q.Set("mature", "false")
	q.Set("page_size", "3")
	endpoint := openverseAPIBase + "?" + q.Encode()

	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", learningUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openverse search: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openverse search failed (%d)", resp.StatusCode)
	}

	var result openverseResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	for _, r := range result.Results {
		if r.Thumbnail != "" {
			return r.Thumbnail, nil
		}
		if r.URL != "" {
			return r.URL, nil
		}
	}
	return "", fmt.Errorf("no image for %q", query)
}
