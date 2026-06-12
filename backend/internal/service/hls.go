package service

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type HLSResult struct {
	Body        []byte
	Status      int
	ContentType string
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
	return "/proxy/hls?url=" + url.QueryEscape(absoluteURL)
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

const embedReferer = "https://nextgencloudfabric.com/"

func ProxyHLS(targetURL string) (*HLSResult, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", embedReferer)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HLS upstream failed: %w", err)
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read HLS body: %w", err)
	}

	isM3U8 := strings.Contains(targetURL, ".m3u8") ||
		strings.Contains(ct, "mpegurl") ||
		strings.Contains(ct, "m3u8")

	isTSSegment := !isM3U8 && (strings.Contains(targetURL, ".ts") ||
		strings.Contains(ct, "mp2t"))

	var finalBody []byte
	if resp.StatusCode == http.StatusOK && isM3U8 {
		rewritten := rewriteM3U8(string(body), targetURL)
		finalBody = []byte(rewritten)
	} else {
		finalBody = body
	}

	if isM3U8 {
		ct = "application/vnd.apple.mpegurl"
	} else if isTSSegment {
		ct = "video/mp2t"
	} else if ct == "" {
		ct = "application/octet-stream"
	}

	return &HLSResult{
		Body:        finalBody,
		Status:      resp.StatusCode,
		ContentType: ct,
	}, nil
}
