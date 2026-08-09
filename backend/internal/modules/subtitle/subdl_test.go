package subtitle

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/bentran/nicefilm/backend/internal/httpx"
	"github.com/bentran/nicefilm/backend/internal/providers/subdl"
)

// stubSubDL stands in for the SubDL client so these tests cover the adapter —
// id minting, labels, unpacking — without touching the network.
type stubSubDL struct {
	subs      []subdl.Subtitle
	archive   []byte
	searchErr error
	dlErr     error

	gotParams subdl.SearchParams
	gotPath   string
}

func (s *stubSubDL) Search(_ string, p subdl.SearchParams) ([]subdl.Subtitle, error) {
	s.gotParams = p
	return s.subs, s.searchErr
}

func (s *stubSubDL) Download(_, archivePath string) ([]byte, error) {
	s.gotPath = archivePath
	return s.archive, s.dlErr
}

func TestSubDLProviderMintsIDs(t *testing.T) {
	stub := &stubSubDL{subs: []subdl.Subtitle{
		{Path: "/subtitle/1-2.zip", ReleaseName: "Show.S01E02.1080p.BluRay", Language: "EN"},
		{Path: "/subtitle/3-4.zip", Name: "fallback.zip", Language: "VI", HI: true},
		{Path: "/subtitle/5-6.zip", ReleaseName: "no language"},
	}}
	season, episode := 1, 2
	opts, err := NewSubDL(stub).Search(Creds{APIKey: "k"}, SubtitleSearchParams{
		IMDbID: "tt1375666", MediaType: "tv", Season: &season, Episode: &episode,
	})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if stub.gotParams.IMDbID != "tt1375666" || stub.gotParams.Episode == nil {
		t.Fatalf("params not forwarded: %+v", stub.gotParams)
	}

	// The episode hint rides along in the ref so a season pack can be unpacked.
	if want := "subdl:/subtitle/1-2.zip|S01E02"; opts[0].ID != want {
		t.Errorf("ID = %q, want %q", opts[0].ID, want)
	}
	if opts[0].Language != "en" || opts[0].Label != "EN — Show.S01E02.1080p.BluRay" {
		t.Errorf("option = %+v", opts[0])
	}
	// No release name: the archive filename stands in, and HI is marked.
	if opts[1].Release != "fallback.zip" || !strings.HasSuffix(opts[1].Label, "(HI)") {
		t.Errorf("option = %+v", opts[1])
	}
	// No language at all still yields something selectable.
	if opts[2].Language != "und" {
		t.Errorf("language = %q, want the und placeholder", opts[2].Language)
	}
}

func TestSubDLProviderOmitsEpisodeHintForMovies(t *testing.T) {
	stub := &stubSubDL{subs: []subdl.Subtitle{{Path: "/subtitle/1-2.zip", Language: "EN"}}}
	opts, err := NewSubDL(stub).Search(Creds{}, SubtitleSearchParams{IMDbID: "tt1", MediaType: "movie"})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if want := "subdl:/subtitle/1-2.zip"; opts[0].ID != want {
		t.Errorf("ID = %q, want %q", opts[0].ID, want)
	}
}

func TestSubDLProviderUnpacksSeasonPack(t *testing.T) {
	stub := &stubSubDL{archive: makeZip(t, map[string]string{
		"Show.S01E01.srt": "1\n00:00:01,000 --> 00:00:02,000\nepisode one\n",
		"Show.S01E02.srt": "1\n00:00:01,000 --> 00:00:02,000\nepisode two\n",
	})}

	vtt, err := NewSubDL(stub).DownloadVTT(Creds{APIKey: "k"}, "/subtitle/pack.zip|S01E02")
	if err != nil {
		t.Fatalf("DownloadVTT: %v", err)
	}
	if stub.gotPath != "/subtitle/pack.zip" {
		t.Errorf("archive path = %q, want the episode hint split off", stub.gotPath)
	}
	if !strings.HasPrefix(vtt, "WEBVTT\n\n") || !strings.Contains(vtt, "episode two") {
		t.Fatalf("DownloadVTT() = %q, want the S01E02 cue", vtt)
	}
	if strings.Contains(vtt, "episode one") {
		t.Fatal("DownloadVTT() returned the wrong episode from the pack")
	}
}

func TestSubDLProviderRejectsEmptyRef(t *testing.T) {
	if _, err := NewSubDL(&stubSubDL{}).DownloadVTT(Creds{}, "|S01E02"); err == nil {
		t.Fatal("DownloadVTT(empty path) = nil error, want one")
	}
}

// The handler tells a throttled shared account apart from any other failure, so
// the client's rate-limit error has to arrive as this package's own.
func TestSubDLProviderRestatesRateLimit(t *testing.T) {
	stub := &stubSubDL{dlErr: fmt.Errorf("SubDL download: %w", httpx.ErrRateLimited)}
	_, err := NewSubDL(stub).DownloadVTT(Creds{}, "/subtitle/1-2.zip")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("DownloadVTT() error = %v, want it to wrap ErrRateLimited", err)
	}
}
