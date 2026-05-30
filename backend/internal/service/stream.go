package service

import (
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

func ProxyStreamRequest(rawQuery string, embedReferer string) (*StreamResult, error) {
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

	resp, err := http.DefaultClient.Do(req)
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

	return &StreamResult{
		Body:        body,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}
