// Command 9film is the macOS desktop build: the same Gin backend and React
// frontend as the two dev processes, but in one window and one process.
//
// The window deliberately has no title bar of its own. mac.TitleBarHiddenInset
// keeps the native traffic lights, hides the title, and lets the webview draw
// under the whole chrome, so the app's own navbar *is* the title bar — the
// frontend marks it draggable with --wails-draggable (see web/src/index.css).
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// The built frontend. go:embed can't reach outside this directory, so
// wails.json's frontend:build copies web/dist here after building it.
//
//go:embed all:dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	// Built before wails.Run rather than in OnStartup: the webview can request
	// an asset the moment the window exists, and the middleware needs the
	// router by then.
	srv, err := newServer()
	if err != nil {
		log.Fatalf("9film: %v", err)
	}

	// The menu bar is built now but can only talk to the window once there is
	// one, so it takes the context through OnStartup.
	nav := &bridge{}

	err = wails.Run(&options.App{
		Title:     "9film",
		Width:     1280,
		Height:    800,
		MinWidth:  960,
		MinHeight: 600,
		// Matches --color-background so the window doesn't flash white before
		// the first paint.
		BackgroundColour: options.NewRGB(10, 10, 10),
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: srv.middleware,
		},
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarHiddenInset(),
			Appearance: mac.NSAppearanceNameDarkAqua,
			About: &mac.AboutInfo{
				Title:   "9film",
				Message: "Stream anything, learn English while you watch.",
				Icon:    icon,
			},
		},
		Menu:               appMenu(nav),
		SingleInstanceLock: &options.SingleInstanceLock{UniqueId: "com.bentran.9film"},
		OnStartup:          nav.startup,
		// The one place the database gets closed: App.Close never runs in the
		// CLI build, since Run blocks until the process dies.
		OnShutdown: srv.shutdown,
	})
	if err != nil {
		log.Fatalf("9film: %v", err)
	}
}
