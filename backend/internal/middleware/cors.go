package middleware

import (
	"net/url"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// The browser origins the frontend is served from — the Vite dev server, and
// whatever `pnpm preview` lands on.
var allowedOrigins = map[string]bool{
	"http://localhost:5173": true,
	"http://localhost:3000": true,
}

// The host the desktop webview serves the app from. It reaches /api through
// the asset-server middleware (same origin, so CORS never applies there) but
// loads HLS over a real loopback URL, which is cross-origin from the webview's
// own scheme — so that one host has to be allowed.
const desktopHost = "wails.localhost"

// allowOrigin matches the desktop webview by host, port and all: a packaged
// build calls itself wails://wails.localhost, but `wails dev` serves the app
// from the dev server's port (wails://wails.localhost:34115, which -devserver
// moves), and a fixed origin string rejects it with a 403 that surfaces as a
// film that never starts.
func allowOrigin(origin string) bool {
	if allowedOrigins[origin] {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	// http as well as wails: the Windows webview reports the former.
	return (u.Scheme == "wails" || u.Scheme == "http") && u.Hostname() == desktopHost
}

// CORS returns the cross-origin middleware for those origins.
//
// Matched by function rather than cors.Config.AllowOrigins because that field
// rejects any scheme outside http/https — and panics doing it — which the
// wails:// origin is.
func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOriginFunc:  allowOrigin,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	})
}
