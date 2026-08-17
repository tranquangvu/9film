package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// The menu bar is the top navbar in native form: the same destinations, in the
// same two groups, in the same order as
// web/src/components/system/common/navbar.tsx. They're kept in step by hand —
// a menu offering somewhere the navbar doesn't is how the two start telling
// different stories about the app.
//
// No item can navigate anything by itself: the router lives in the webview. Each
// one emits an event that web/src/utils/desktop-menu.ts turns into a router
// call, which is also why the menu keeps working on a page the user reloaded.
const (
	eventNavigate = "menu:navigate"
	eventBack     = "menu:back"
	eventForward  = "menu:forward"
)

const sourceURL = "https://github.com/tranquangvu/9film"

// destination is one navbar link as the menu sees it: what it's called, where it
// goes, and the Cmd key that gets there.
type destination struct {
	label string
	path  string
	key   string
}

// The navbar's two groups: browsing in the centre of the bar, personal by the
// avatar. The menu keeps them apart with a separator.
var (
	browseDestinations = []destination{
		{"Home", "/", "1"},
		{"Browse", "/browse", "2"},
		{"Movies", "/movies", "3"},
		{"TV Series", "/tvs", "4"},
	}
	personalDestinations = []destination{
		{"My List", "/my-list", "5"},
		{"My Learning", "/my-learning", "6"},
	}
)

// bridge holds the context Wails hands over at startup. The menu is built before
// wails.Run — there is no window to emit to yet — and a menu item can't be
// clicked before there is one, so the nil check is the whole guard needed.
type bridge struct{ ctx context.Context }

func (b *bridge) startup(ctx context.Context) { b.ctx = ctx }

// click returns a menu callback that emits event to the frontend.
func (b *bridge) click(event string, data ...any) menu.Callback {
	return func(*menu.CallbackData) {
		if b.ctx == nil {
			return
		}
		wailsruntime.EventsEmit(b.ctx, event, data...)
	}
}

// openURL returns a menu callback that hands a link to the user's browser rather
// than opening it in the app's own window.
func (b *bridge) openURL(url string) menu.Callback {
	return func(*menu.CallbackData) {
		if b.ctx == nil {
			return
		}
		wailsruntime.BrowserOpenURL(b.ctx, url)
	}
}

func appMenu(b *bridge) *menu.Menu {
	m := menu.NewMenu()
	// Neither role menu is decoration. The app menu is where macOS puts About
	// and Quit, and without an Edit menu the system has nothing to route
	// Cmd-C/V/A through — the API-key fields would stop taking a paste.
	m.Append(menu.AppMenu())
	m.Append(menu.EditMenu())

	// "Go" rather than "View": these move you somewhere, which is what Finder
	// and Safari use the name for — including Back and Forward on the same keys.
	goMenu := m.AddSubmenu("Go")
	goMenu.AddText("Back", keys.CmdOrCtrl("["), b.click(eventBack))
	goMenu.AddText("Forward", keys.CmdOrCtrl("]"), b.click(eventForward))
	goMenu.AddSeparator()
	for _, d := range browseDestinations {
		goMenu.AddText(d.label, keys.CmdOrCtrl(d.key), b.click(eventNavigate, d.path))
	}
	goMenu.AddSeparator()
	for _, d := range personalDestinations {
		goMenu.AddText(d.label, keys.CmdOrCtrl(d.key), b.click(eventNavigate, d.path))
	}
	goMenu.AddSeparator()
	// The navbar's search button opens an overlay; the menu goes to the search
	// page instead, which is the same search without reaching across the
	// component that owns the overlay's state.
	goMenu.AddText("Search", keys.CmdOrCtrl("f"), b.click(eventNavigate, "/search"))
	goMenu.AddText("Profile", keys.CmdOrCtrl(","), b.click(eventNavigate, "/profile"))

	m.Append(menu.WindowMenu())

	// The footer's two links, plus where the app came from.
	help := m.AddSubmenu("Help")
	help.AddText("About 9film", nil, b.click(eventNavigate, "/about"))
	help.AddText("Disclaimer", nil, b.click(eventNavigate, "/disclaimer"))
	help.AddSeparator()
	help.AddText("Source on GitHub", nil, b.openURL(sourceURL))

	return m
}
