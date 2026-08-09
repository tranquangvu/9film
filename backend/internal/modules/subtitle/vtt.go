package subtitle

import (
	"fmt"
	"path"
	"regexp"
	"strings"
)

// SRT-parsing regexes, compiled once (they were previously recompiled per call
// and per cue block inside srtToVTT's loop — pure overhead on every download).
var (
	srtBlockSplitRe = regexp.MustCompile(`\n{2,}`)
	srtIndexLineRe  = regexp.MustCompile(`^\d+$`)
	srtTimeRe       = regexp.MustCompile(`^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})`)
)

// toVTT converts a downloaded subtitle file to WebVTT, choosing the conversion
// from its filename. Styled formats are rejected rather than run through
// srtToVTT: that would yield a valid but cue-less VTT, so the track would load
// and silently show nothing — worse than a visible failure.
func toVTT(name string, raw []byte) (string, error) {
	text := strings.TrimPrefix(string(raw), "\ufeff")

	switch strings.ToLower(path.Ext(name)) {
	case ".vtt":
		return ensureVTTHeader(text), nil
	case ".ass", ".ssa":
		return "", fmt.Errorf("unsupported subtitle format %q (only SRT and VTT are supported)", path.Ext(name))
	default:
		return srtToVTT(text), nil
	}
}

func ensureVTTHeader(text string) string {
	if strings.HasPrefix(strings.TrimSpace(text), "WEBVTT") {
		return text
	}
	return "WEBVTT\n\n" + text
}

func srtToVTT(srt string) string {
	normalized := strings.ReplaceAll(srt, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")

	if strings.TrimSpace(normalized) == "" {
		return "WEBVTT\n\n"
	}

	blocks := srtBlockSplitRe.Split(normalized, -1)
	var cues []string

	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}
		lines := strings.Split(block, "\n")
		if len(lines) < 2 {
			continue
		}

		timeIdx := 0
		if srtIndexLineRe.MatchString(strings.TrimSpace(lines[0])) {
			timeIdx = 1
		}

		if timeIdx >= len(lines) {
			continue
		}

		timeLine := strings.TrimSpace(lines[timeIdx])
		if !srtTimeRe.MatchString(timeLine) {
			continue
		}

		vttTimeLine := strings.ReplaceAll(timeLine, ",", ".")
		text := strings.TrimSpace(strings.Join(lines[timeIdx+1:], "\n"))
		if text == "" {
			continue
		}
		cues = append(cues, vttTimeLine+"\n"+text)
	}

	return "WEBVTT\n\n" + strings.Join(cues, "\n\n") + "\n"
}
