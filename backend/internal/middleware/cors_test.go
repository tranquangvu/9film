package middleware

import "testing"

// The desktop build only ever reaches /hls cross-origin, so a rejected origin
// costs nothing anywhere else — the film simply never starts, with the reason
// buried in the webview's console.
func TestAllowOrigin(t *testing.T) {
	cases := []struct {
		origin string
		want   bool
	}{
		{"http://localhost:5173", true},
		{"wails://wails", true},                 // packaged build on macOS — see desktopHostMac
		{"wails://wails.localhost", true},       // the URL the page is loaded from
		{"wails://wails.localhost:34115", true}, // wails dev
		{"http://wails.localhost:1234", true},   // the Windows webview
		{"http://localhost:8080", false},        // not a frontend of ours
		{"https://wails.localhost.evil", false}, // suffix, not the host
		{"https://wails.localhost", false},      // the webview never uses https
		{"http://wails", false},                 // bare host, but only the custom scheme sends it
		{"", false},
	}

	for _, c := range cases {
		if got := allowOrigin(c.origin); got != c.want {
			t.Errorf("allowOrigin(%q) = %v, want %v", c.origin, got, c.want)
		}
	}
}
