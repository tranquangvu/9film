package stream

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

const streamAPIURL = "https://streamdata.vaplayer.ru/api.php"

// The Referer the upstream CDNs require is the host of the embed page's first
// iframe. Injecting it server-side is the whole reason these endpoints proxy
// instead of the browser calling direct. It's discovered at runtime (the host
// changes from time to time) and cached, with this known-good value as the
// fallback when discovery fails.
const (
	embedRefererDefault = "https://nextgencloudfabric.com/"
	embedDiscoveryURL   = "https://vaplayer.ru/embed/movie/tt0371746"
	refererTTL          = time.Hour
	discoveryUA         = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

// iframeSrcRe captures the src of the first <iframe> in the embed page HTML.
var iframeSrcRe = regexp.MustCompile(`(?i)<iframe[^>]*\bsrc=["']([^"']+)["']`)

// refererResolver discovers and caches the upstream Referer by scraping the embed
// page's first iframe host. Refreshes run in the background so request handlers
// never block on the upstream fetch; on any failure the last known good value is
// kept (seeded with embedRefererDefault).
type refererResolver struct {
	client     *http.Client
	mu         sync.RWMutex
	value      string
	expiry     time.Time
	refreshing bool
}

func newRefererResolver() *refererResolver {
	r := &refererResolver{
		client: &http.Client{Timeout: 10 * time.Second},
		value:  embedRefererDefault,
	}
	// Warm the cache once at startup so the first stream uses a fresh value.
	r.refreshing = true
	go r.refresh()
	return r
}

// Referer returns the current upstream Referer, kicking off a single background
// refresh when the cached value has expired.
func (r *refererResolver) Referer() string {
	r.mu.RLock()
	val, exp, refreshing := r.value, r.expiry, r.refreshing
	r.mu.RUnlock()
	if refreshing || time.Now().Before(exp) {
		return val
	}

	r.mu.Lock()
	// Re-check under the write lock — another goroutine may have started refreshing.
	if r.refreshing || time.Now().Before(r.expiry) {
		val = r.value
		r.mu.Unlock()
		return val
	}
	r.refreshing = true
	val = r.value
	r.mu.Unlock()

	go r.refresh()
	return val
}

func (r *refererResolver) refresh() {
	v, err := r.discover()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.refreshing = false
	if err != nil || v == "" {
		// Keep the last good value; back off briefly before retrying.
		r.expiry = time.Now().Add(time.Minute)
		logger.Get().Warn("embed Referer discovery failed; using cached value",
			zap.String("referer", r.value), zap.Error(err))
		return
	}
	if v != r.value {
		logger.Get().Info("embed Referer updated", zap.String("from", r.value), zap.String("to", v))
	}
	r.value = v
	r.expiry = time.Now().Add(refererTTL)
}

// discover fetches the embed page and returns "scheme://host/" of its first iframe.
func (r *refererResolver) discover() (string, error) {
	req, err := http.NewRequest(http.MethodGet, embedDiscoveryURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", discoveryUA)

	resp, err := r.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("embed page returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	return refererFromHTML(body)
}

// refererFromHTML extracts "scheme://host/" from the first <iframe src> in the
// embed page HTML.
func refererFromHTML(body []byte) (string, error) {
	m := iframeSrcRe.FindSubmatch(body)
	if m == nil {
		return "", fmt.Errorf("no iframe src in embed page")
	}
	u, err := url.Parse(string(m[1]))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid iframe src %q", string(m[1]))
	}
	return u.Scheme + "://" + u.Host + "/", nil
}

type Stream interface {
	ProxyStreamRequest(rawQuery string) (*StreamResult, error)
}

type stream struct {
	client  *http.Client
	referer *refererResolver
}

func NewStream(referer *refererResolver) Stream {
	// Whole-response timeout is fine here: the upstream returns a small JSON body.
	return &stream{client: &http.Client{Timeout: 15 * time.Second}, referer: referer}
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
	req.Header.Set("Referer", s.referer.Referer())
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
	client  *http.Client
	referer *refererResolver
}

func NewHLS(referer *refererResolver) HLS {
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
	}, referer: referer}
}

func (s *hls) ProxyHLS(targetURL string) (*HLSResult, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", s.referer.Referer())

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
