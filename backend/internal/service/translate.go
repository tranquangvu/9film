package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Upstream free translation endpoint (no API key). Isolated here so the source
// can be swapped without touching handlers, like embedReferer in hls.go.
const translateAPIBase = "https://api.mymemory.translated.net/get"

var translateClient = &http.Client{Timeout: 8 * time.Second}

type translateResponse struct {
	ResponseData struct {
		TranslatedText string `json:"translatedText"`
	} `json:"responseData"`
	ResponseStatus int `json:"responseStatus"`
}

// Translate renders English text into the target language (e.g. "vi"). It
// returns an empty string (no error) on upstream failure so the caller can
// still serve a dictionary-only response.
func Translate(text, target string) (string, error) {
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
	req.Header.Set("User-Agent", openSubsUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := translateClient.Do(req)
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
