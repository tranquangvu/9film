package stream

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// embedReferer is the Referer the upstream CDNs require. Injecting it server-side
// is the whole reason these endpoints proxy instead of the browser calling direct.
const embedReferer = "https://nextgencloudfabric.com/"

const streamAPIURL = "https://streamdata.vaplayer.ru/api.php"

type Stream interface {
	ProxyStreamRequest(rawQuery string) (*StreamResult, error)
}

type stream struct {
	client *http.Client
}

func NewStream() Stream {
	// Whole-response timeout is fine here: the upstream returns a small JSON body.
	return &stream{client: &http.Client{Timeout: 15 * time.Second}}
}

func (s *stream) ProxyStreamRequest(rawQuery string) (*StreamResult, error) {
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

func toAbsoluteURL(baseRaw, ref string) string {
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref
	}
	base, err := url.Parse(baseRaw)
	if err != nil {
		return ref
	}
	if strings.HasPrefix(ref, "/") {
		return fmt.Sprintf("%s://%s%s", base.Scheme, base.Host, ref)
	}
	resolved, err := base.Parse(ref)
	if err != nil {
		return ref
	}
	return resolved.String()
}

func toProxyPath(absoluteURL string) string {
	return "/hls?url=" + url.QueryEscape(absoluteURL)
}

func rewriteM3U8(body, sourceURL string) string {
	lines := strings.Split(body, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "#") {
			lines[i] = rewriteURIAttributes(line, sourceURL)
		} else {
			lines[i] = toProxyPath(toAbsoluteURL(sourceURL, trimmed))
		}
	}
	return strings.Join(lines, "\n")
}

func rewriteURIAttributes(line, sourceURL string) string {
	const prefix = `URI="`
	for {
		start := strings.Index(line, prefix)
		if start == -1 {
			break
		}
		uriStart := start + len(prefix)
		end := strings.Index(line[uriStart:], `"`)
		if end == -1 {
			break
		}
		uri := line[uriStart : uriStart+end]
		absolute := toAbsoluteURL(sourceURL, uri)
		proxy := toProxyPath(absolute)
		line = line[:uriStart] + proxy + line[uriStart+end:]
	}
	return line
}

// HLS proxies HLS manifests and segments, rewriting manifest URIs back through
// the local /hls route so the CDN only ever sees the server's Referer.
type HLS interface {
	ProxyHLS(targetURL string) (*HLSResult, error)
}

type hls struct {
	client *http.Client
}

func NewHLS() HLS {
	// No whole-request timeout — segment bodies stream and may be large/slow.
	// ResponseHeaderTimeout bounds a stuck upstream without truncating transfers,
	// and a raised MaxIdleConnsPerHost lets concurrent segment fetches reuse
	// connections to the same CDN host (the default of 2 throttles playback).
	return &hls{client: &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   16,
			IdleConnTimeout:       90 * time.Second,
			ResponseHeaderTimeout: 15 * time.Second,
		},
	}}
}

func (s *hls) ProxyHLS(targetURL string) (*HLSResult, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", embedReferer)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HLS upstream failed: %w", err)
	}

	ct := resp.Header.Get("Content-Type")
	isM3U8 := strings.Contains(targetURL, ".m3u8") ||
		strings.Contains(ct, "mpegurl") ||
		strings.Contains(ct, "m3u8")

	// Only manifests need rewriting, so only manifests are read into memory.
	// Segments (the bulk of the bytes) stream straight through — the caller
	// io.Copy's and closes resp.Body, so memory stays flat per viewer.
	if resp.StatusCode == http.StatusOK && isM3U8 {
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("read HLS manifest: %w", err)
		}
		return &HLSResult{
			Body:        []byte(rewriteM3U8(string(body), targetURL)),
			Status:      resp.StatusCode,
			ContentType: "application/vnd.apple.mpegurl",
		}, nil
	}

	if isM3U8 {
		ct = "application/vnd.apple.mpegurl"
	} else if strings.Contains(targetURL, ".ts") || strings.Contains(ct, "mp2t") {
		ct = "video/mp2t"
	} else if ct == "" {
		ct = "application/octet-stream"
	}

	return &HLSResult{
		Stream:      resp.Body,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}
