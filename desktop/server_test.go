package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The loopback address reaches the frontend only through this injection, and a
// miss is silent: bytes.Replace no-ops, apiOrigin falls back to '', and video
// playback breaks in the packaged app alone.
func TestServeIndexInjectsAPIBase(t *testing.T) {
	// dist/ holds only .gitkeep until the frontend is built.
	if _, err := assets.ReadFile("dist/index.html"); err != nil {
		t.Skip("frontend not built — run `make build` first")
	}

	s := &server{base: "http://127.0.0.1:54321"}
	w := httptest.NewRecorder()

	s.serveIndex(w)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	body := w.Body.String()
	want := `<script>window.__9FILM_API__="http://127.0.0.1:54321";</script>`
	if !strings.Contains(body, want) {
		t.Errorf("index.html is missing %s", want)
	}
	if i, j := strings.Index(body, want), strings.Index(body, "</head>"); j >= 0 && i > j {
		t.Errorf("injected script landed outside <head>")
	}
}
