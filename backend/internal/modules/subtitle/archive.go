package subtitle

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"path"
	"regexp"
	"strconv"
	"strings"
)

const (
	// Subtitle files are tens of kilobytes; these caps only exist so a wrong or
	// hostile URL can't stream an unbounded body into memory. archive/zip needs an
	// io.ReaderAt, so the whole download is buffered either way.
	maxDownloadBytes = 16 << 20
	maxSubtitleBytes = 8 << 20
)

// subtitleExts is the priority order used to break ties inside an archive: SRT
// and VTT convert cleanly, SUB is a last resort, and styled formats are only
// picked when there is nothing else (toVTT then rejects them with a clear error).
var subtitleExts = []string{".srt", ".vtt", ".sub", ".ass", ".ssa"}

var hintRe = regexp.MustCompile(`^[sS](\d+)[eE](\d+)$`)

func isGzip(b []byte) bool { return len(b) >= 2 && b[0] == 0x1f && b[1] == 0x8b }
func isZip(b []byte) bool  { return len(b) >= 4 && string(b[:4]) == "PK\x03\x04" }

// subtitleFromArchive unwraps a downloaded body into one subtitle file: a ZIP
// (SubDL), a gzip stream (OpenSubtitles download links) or a plain file. hint is
// an optional "S01E02" episode marker used to pick the right entry out of a
// season pack; it is ignored for single-file downloads.
func subtitleFromArchive(raw []byte, hint string) (name string, data []byte, err error) {
	switch {
	case isZip(raw):
		zr, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
		if err != nil {
			return "", nil, fmt.Errorf("open subtitle archive: %w", err)
		}
		entry := pickZipEntry(zr.File, hint)
		if entry == nil {
			return "", nil, errors.New("no subtitle file in archive")
		}
		rc, err := entry.Open()
		if err != nil {
			return "", nil, fmt.Errorf("read %s from archive: %w", entry.Name, err)
		}
		defer rc.Close()
		data, err := io.ReadAll(io.LimitReader(rc, maxSubtitleBytes))
		if err != nil {
			return "", nil, fmt.Errorf("read %s from archive: %w", entry.Name, err)
		}
		return path.Base(entry.Name), data, nil

	case isGzip(raw):
		gr, err := gzip.NewReader(bytes.NewReader(raw))
		if err != nil {
			return "", nil, fmt.Errorf("gzip reader: %w", err)
		}
		defer gr.Close()
		data, err := io.ReadAll(io.LimitReader(gr, maxSubtitleBytes))
		if err != nil {
			return "", nil, fmt.Errorf("gzip decompress: %w", err)
		}
		return gr.Name, data, nil

	default:
		return "", raw, nil
	}
}

// pickZipEntry chooses the subtitle to serve out of an archive: the entry
// matching the requested episode when there is one (season packs hold one file
// per episode), then by format preference, then the largest — which drops
// "sample" and credits stubs that sit next to the real thing.
func pickZipEntry(files []*zip.File, hint string) *zip.File {
	var best *zip.File
	bestRank := -1

	for _, f := range files {
		if f.FileInfo().IsDir() || !isSubtitleEntry(f.Name) {
			continue
		}
		rank := extRank(f.Name)
		if hint != "" && entryMatchesEpisode(f.Name, hint) {
			rank += len(subtitleExts) // an episode match outranks every format preference
		}
		if rank > bestRank || (rank == bestRank && f.UncompressedSize64 > best.UncompressedSize64) {
			best, bestRank = f, rank
		}
	}
	return best
}

func isSubtitleEntry(name string) bool {
	if strings.HasPrefix(name, "__MACOSX/") || strings.HasPrefix(path.Base(name), "._") {
		return false
	}
	return extRank(name) >= 0
}

// extRank scores a filename by subtitle format, best first; -1 when it isn't a
// subtitle at all.
func extRank(name string) int {
	ext := strings.ToLower(path.Ext(name))
	for i, want := range subtitleExts {
		if ext == want {
			return len(subtitleExts) - i
		}
	}
	return -1
}

// entryMatchesEpisode reports whether a filename inside a pack refers to the
// episode in hint ("S01E02"). Packs are named every which way, so the common
// spellings are all accepted.
func entryMatchesEpisode(name, hint string) bool {
	m := hintRe.FindStringSubmatch(hint)
	if m == nil {
		return false
	}
	season, _ := strconv.Atoi(m[1])
	episode, _ := strconv.Atoi(m[2])

	base := strings.ToLower(path.Base(name))
	for _, pattern := range []string{
		fmt.Sprintf("s%02de%02d", season, episode),
		fmt.Sprintf("s%de%d", season, episode),
		fmt.Sprintf("%dx%02d", season, episode),
		fmt.Sprintf("%dx%d", season, episode),
		fmt.Sprintf("e%02d", episode),
	} {
		if strings.Contains(base, pattern) {
			return true
		}
	}
	return false
}
