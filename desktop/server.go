package main

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	backend "github.com/bentran/9film/backend/server"
)

// The backend is reachable two ways, both serving the same *gin.Engine:
//
//  1. through the Wails asset server (middleware below). Same origin as the
//     frontend, so every relative /api path in web/ keeps working untouched.
//  2. over a real loopback listener. WKWebView hands <video> URLs to
//     AVFoundation, which can't resolve the asset server's custom scheme, so
//     the HLS proxy has to be an ordinary http:// URL. The frontend learns the
//     address from window.__9FILM_API__, injected into index.html below.
type server struct {
	api  *backend.Server
	base string // http://127.0.0.1:<port>
}

// devPort is tried first so `wails dev` lines up with web/vite.config.ts, whose
// proxy targets :8081. Taken (a `make dev` backend is already running) means we
// fall back to an ephemeral port, which is why the base URL is injected rather
// than hard-coded in the frontend.
const devPort = 8081

func newServer() (*server, error) {
	dir, err := dataDir()
	if err != nil {
		return nil, err
	}
	// database.Open won't create the parent directory, and a fresh install has
	// none.
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create %s: %w", dir, err)
	}
	// config.Load reads these; it has no other input, and the .env it looks for
	// isn't in a bundle.
	os.Setenv("DB_PATH", filepath.Join(dir, "9film.db"))
	os.Setenv("GIN_MODE", "release")

	api, err := backend.New()
	if err != nil {
		return nil, err
	}

	ln, err := listen()
	if err != nil {
		api.Close()
		return nil, err
	}
	go http.Serve(ln, api.Handler())

	return &server{api: api, base: "http://" + ln.Addr().String()}, nil
}

// dataDir is where the database lives — outside the bundle, which is read-only
// and replaced on every install. Deliberately not the CLI build's ./9film.db:
// the desktop app keeps its own library.
func dataDir() (string, error) {
	base, err := os.UserConfigDir() // ~/Library/Application Support on macOS
	if err != nil {
		return "", fmt.Errorf("locate the application support directory: %w", err)
	}
	return filepath.Join(base, "9film"), nil
}

func listen() (net.Listener, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", devPort))
	if err == nil {
		return ln, nil
	}
	ln, err = net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("listen on loopback: %w", err)
	}
	return ln, nil
}

func (s *server) shutdown(_ context.Context) {
	s.api.Close() // closes the DB, so SQLite checkpoints its WAL
}

// middleware sits in front of the embedded assets: API and HLS requests go to
// Gin, HTML requests get the index page with the loopback address injected, and
// everything else falls through to the embedded files.
func (s *server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/hls" || p == "/api" || strings.HasPrefix(p, "/api/") {
			s.api.Handler().ServeHTTP(w, r)
			return
		}
		// A client-side route (/watch/tt123) has no extension and no file
		// behind it. Without this, reloading the window 404s.
		//
		// Extensionless is not enough on its own: under `wails dev` Vite serves
		// its own virtual modules from /@vite/client and /@react-refresh, which
		// have no extension either. Answering those with HTML makes the module
		// preamble fail to parse and nothing ever mounts. Only a navigation
		// asks for text/html — a script or a fetch asks for */*.
		if path.Ext(p) == "" && strings.Contains(r.Header.Get("Accept"), "text/html") {
			s.serveIndex(w, r, next)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// serveIndex asks whatever sits behind the asset server for the index page and
// rewrites it, rather than reading the embedded copy. Under `wails dev` that is
// the Vite dev server, whose index.html points at /src/main.tsx; the embedded
// dist/index.html points at hashed bundles the dev server has never heard of,
// so serving it there loads no script at all and the window stays black.
func (s *server) serveIndex(w http.ResponseWriter, r *http.Request, next http.Handler) {
	req := r.Clone(r.Context())
	req.URL.Path = "/"
	req.URL.RawQuery = ""

	rec := &capture{header: http.Header{}}
	next.ServeHTTP(rec, req)
	if rec.status >= http.StatusBadRequest {
		http.Error(w, "index.html missing from the bundle", http.StatusInternalServerError)
		return
	}

	// Injected rather than bound: the frontend needs the address on its first
	// render, and a Wails binding only resolves after the runtime is ready.
	tag := fmt.Sprintf("<script>window.__9FILM_API__=%q;</script>", s.base)
	html := bytes.Replace(rec.body.Bytes(), []byte("<head>"), []byte("<head>"+tag), 1)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	w.Write(html)
}

// capture buffers a handler's response so the HTML can be rewritten before any
// of it reaches the webview.
type capture struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func (c *capture) Header() http.Header { return c.header }

func (c *capture) WriteHeader(status int) {
	if c.status == 0 {
		c.status = status
	}
}

func (c *capture) Write(p []byte) (int, error) {
	c.WriteHeader(http.StatusOK)
	return c.body.Write(p)
}
