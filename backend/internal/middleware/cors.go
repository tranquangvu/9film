package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// The origins the frontend is ever served from: the Vite dev server, and the
// webview of the desktop build. The desktop app reaches /api through its
// asset-server middleware (same origin, so CORS never applies there) but loads
// HLS over a real loopback URL, which is cross-origin from the webview's own
// scheme — hence the wails entries.
var allowedOrigins = map[string]bool{
	"http://localhost:5173":   true,
	"http://localhost:3000":   true,
	"wails://wails.localhost": true,
	"http://wails.localhost":  true,
}

// CORS returns the cross-origin middleware for those origins.
//
// Matched by function rather than cors.Config.AllowOrigins because that field
// rejects any scheme outside http/https — and panics doing it — which the
// wails:// origin is.
func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOriginFunc:  func(origin string) bool { return allowedOrigins[origin] },
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	})
}
