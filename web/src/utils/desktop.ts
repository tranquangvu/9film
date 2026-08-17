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
 * True in the Wails window. Set by desktop/Makefile's frontend-dev and
 * frontend-build targets, which back wails.json's hooks — so it's a
 * compile-time constant rather than a runtime sniff of the webview.
 */
export const isDesktop = import.meta.env.VITE_DESKTOP === '1';

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
