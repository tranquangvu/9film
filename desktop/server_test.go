package main

import (
	"io/fs"
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

	dist, err := fs.Sub(assets, "dist")
	if err != nil {
		t.Fatal(err)
	}

	s := &server{base: "http://127.0.0.1:54321"}
	w := httptest.NewRecorder()

	// Stands in for the Wails asset server: the page comes from behind the
	// middleware, whether that is the embedded bundle or the Vite dev server.
	s.serveIndex(w, httptest.NewRequest(http.MethodGet, "/watch/tt0111161", nil), http.FileServer(http.FS(dist)))

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

// Vite's dev modules are extensionless too, so the SPA fallback has to tell a
// navigation apart from a script fetch. Getting this wrong is invisible in the
// packaged build and blanks the window under `wails dev`.
func TestMiddlewareRoutesByAccept(t *testing.T) {
	cases := []struct {
		name, path, accept string
		wantIndex          bool
	}{
		{"navigation", "/watch/tt0111161", "text/html,application/xhtml+xml,*/*;q=0.8", true},
		{"root", "/", "text/html,application/xhtml+xml,*/*;q=0.8", true},
		{"vite client", "/@vite/client", "*/*", false},
		{"react refresh", "/@react-refresh", "*/*", false},
		{"bundle", "/assets/index-abc123.js", "*/*", false},
	}

	// Stands in for the asset server behind the middleware: "/" is the index
	// page serveIndex asks for, everything else is a plain asset.
	const passed = "reached the asset server"
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte("<html><head></head><body></body></html>"))
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(passed))
	})

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := &server{base: "http://127.0.0.1:54321"}
			r := httptest.NewRequest(http.MethodGet, c.path, nil)
			r.Header.Set("Accept", c.accept)
			w := httptest.NewRecorder()

			s.middleware(next).ServeHTTP(w, r)

			// serveIndex rewrites whatever next returned; anything else hands
			// the response straight through.
			gotIndex := strings.Contains(w.Body.String(), "__9FILM_API__")
			if gotIndex != c.wantIndex {
				t.Errorf("served index = %v, want %v (body %q)", gotIndex, c.wantIndex, w.Body.String())
			}
			if !c.wantIndex && w.Body.String() != passed {
				t.Errorf("body = %q, want it passed through untouched", w.Body.String())
			}
		})
	}
}
