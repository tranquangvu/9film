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

// The hosts the desktop webview serves the app from. It reaches /api through
// the asset-server middleware (same origin, so CORS never applies there) but
// loads HLS over a real loopback URL, which is cross-origin from the webview's
// own scheme — so those hosts have to be allowed.
//
// Two of them, because the page is served from wails://wails.localhost but
// WebKit serializes that origin as wails://wails — the custom scheme is not a
// "special" URL scheme, so the .localhost suffix does not survive into the
// Origin header. That is the origin the packaged macOS app actually sends.
const (
	desktopHost    = "wails.localhost"
	desktopHostMac = "wails"
)

// allowOrigin matches the desktop webview by host, port and all: `wails dev`
// serves the app from the dev server's port (wails://wails.localhost:34115,
// which -devserver moves), and a fixed origin string rejects it with a 403 that
// surfaces as a film that never starts.
func allowOrigin(origin string) bool {
	if allowedOrigins[origin] {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	// http as well as wails: the Windows webview reports the former.
	if u.Scheme != "wails" && u.Scheme != "http" {
		return false
	}
	host := u.Hostname()
	// The bare host only ever comes out of the custom scheme; http://wails is
	// not something a webview of ours sends.
	return host == desktopHost || (u.Scheme == "wails" && host == desktopHostMac)
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
