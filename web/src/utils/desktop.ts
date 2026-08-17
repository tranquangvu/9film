// What the desktop build (desktop/, Wails) needs from the frontend. In the
// browser build both values are inert, so nothing here branches at runtime
// except where the desktop genuinely differs.

declare global {
  interface Window {
    /** Injected into index.html by desktop/server.go — see apiOrigin. */
    __9FILM_API__?: string;
  }
}

/**
 * Absolute origin of the backend, or '' when relative paths already reach it.
 *
 * Only media needs this. The desktop app serves /api through the Wails asset
 * server, so relative paths stay same-origin — but a <video> src is handed to
 * AVFoundation, which can't resolve the webview's scheme and needs a real
 * http:// URL. The port isn't fixed (8081 may be taken by `make dev`), so the
 * Go side injects the address it actually bound.
 */
export const apiOrigin = (typeof window !== 'undefined' && window.__9FILM_API__) || '';

/**
 * True when the page really is the desktop app — the Wails window, or the app's
 * own server opened in a browser. It gates the window chrome in index.css.
 *
 * VITE_DESKTOP (set by desktop/Makefile's frontend-* targets) says the bundle
 * was built for the desktop, which is not the same thing: `wails dev` runs one
 * Vite server for both sides, so http://localhost:5173 in a browser gets that
 * bundle and would otherwise wear a title bar's insets with no title bar around
 * it. apiOrigin is the half only the desktop server can produce, so requiring
 * both keeps the browser looking like the browser.
 */
export const isDesktop = import.meta.env.VITE_DESKTOP === '1' && apiOrigin !== '';
