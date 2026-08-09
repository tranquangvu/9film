package subdl

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestLangCodes(t *testing.T) {
	for in, want := range map[string]string{
		"":         "EN",
		"en":       "EN",
		"en-US":    "EN",
		"vi":       "VI",
		"en,vi":    "EN,VI",
		" en , fr": "EN,FR",
	} {
		if got := langCodes(in); got != want {
			t.Errorf("langCodes(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizeIMDbID(t *testing.T) {
	for in, want := range map[string]string{
		"tt1375666": "tt1375666",
		"TT1375666": "tt1375666",
		"1375666":   "tt1375666",
		"":          "",
	} {
		if got := normalizeIMDbID(in); got != want {
			t.Errorf("normalizeIMDbID(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSearch(t *testing.T) {
	var gotQuery url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":true,"subtitles":[
			{"release_name":"Show.S01E02.1080p.BluRay","language":"EN","lang":"english","url":"/subtitle/1-2.zip","hi":false},
			{"release_name":"Show.S01E02.WEB","language":"VI","lang":"vietnamese","url":"/subtitle/3-4.zip","hi":true},
			{"release_name":"broken","language":"EN","url":""}
		]}`))
	}))
	defer srv.Close()

	c := New()
	c.apiBase = srv.URL

	season, episode := 1, 2
	subs, err := c.Search("k", SearchParams{
		IMDbID: "tt1375666", MediaType: "tv", Season: &season, Episode: &episode, Languages: "en",
	})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}

	if got := gotQuery.Get("imdb_id"); got != "tt1375666" {
		t.Errorf("imdb_id = %q, want the full tt form", got)
	}
	for key, want := range map[string]string{
		"api_key": "k", "type": "tv", "languages": "EN", "season_number": "1", "episode_number": "2",
	} {
		if got := gotQuery.Get(key); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}

	if len(subs) != 2 {
		t.Fatalf("got %d subtitles, want 2 (the url-less entry is skipped)", len(subs))
	}
	if subs[0].Path != "/subtitle/1-2.zip" || subs[0].Language != "EN" {
		t.Errorf("subtitle = %+v", subs[0])
	}
	if !subs[1].HI {
		t.Error("hearing-impaired flag not carried through")
	}
}

// SubDL hands back archive paths with the querying account's key already in the
// query string. It must not survive into Path, which travels onwards into the
// subtitle id the browser sees.
func TestSearchStripsAPIKeyFromPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":true,"subtitles":[
			{"release_name":"Show.S01E02.WEB","language":"EN","url":"/subtitle/1-2.zip?api_key=secret"}
		]}`))
	}))
	defer srv.Close()

	c := New()
	c.apiBase = srv.URL

	subs, err := c.Search("secret", SearchParams{IMDbID: "tt1375666", MediaType: "movie"})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if subs[0].Path != "/subtitle/1-2.zip" {
		t.Errorf("Path = %q, want the api_key stripped", subs[0].Path)
	}
}

func TestSearchReportsFailureInsideOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":false,"error":"invalid api key"}`))
	}))
	defer srv.Close()

	c := New()
	c.apiBase = srv.URL

	if _, err := c.Search("k", SearchParams{IMDbID: "tt1", MediaType: "movie"}); err == nil {
		t.Fatal("Search() = nil error, want the failure reported inside the 200")
	}
}

func TestDownload(t *testing.T) {
	var gotURL, gotHeader string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURL, gotHeader = r.URL.String(), r.Header.Get("X-API-KEY")
		_, _ = w.Write([]byte("archive bytes"))
	}))
	defer srv.Close()

	c := New()
	c.downloadBase = srv.URL

	// A path saved before cleanPath existed still carries the key; the download
	// must work and must not put it back on the wire.
	raw, err := c.Download("secret", "/subtitle/1-2.zip?api_key=secret")
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	if string(raw) != "archive bytes" {
		t.Errorf("Download() = %q", raw)
	}
	if gotURL != "/subtitle/1-2.zip" {
		t.Errorf("download URL = %q, want the key stripped", gotURL)
	}
	if gotHeader != "secret" {
		t.Errorf("X-API-KEY = %q, want the key sent as a header", gotHeader)
	}
}

func TestDownloadReportsRateLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte("slow down"))
	}))
	defer srv.Close()

	c := New()
	c.downloadBase = srv.URL

	_, err := c.Download("k", "/subtitle/1-2.zip")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("Download() error = %v, want it to wrap ErrRateLimited", err)
	}
}
