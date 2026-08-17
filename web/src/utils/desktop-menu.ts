import type { createBrowserRouter } from 'react-router-dom';

// The other half of desktop/menu.go. A native menu item can't touch the router,
// so it emits an event over the Wails runtime and this turns it into a router
// call. Done through the router object rather than a hook so one binding covers
// every route — including /watch, which lives under its own layout.

declare global {
  interface Window {
    /**
     * Injected by Wails into the desktop window only. Absent in the browser
     * build, which is what makes all of this inert there.
     */
    runtime?: {
      EventsOn(event: string, callback: (...data: unknown[]) => void): (() => void) | void;
    };
  }
}

type Router = ReturnType<typeof createBrowserRouter>;

export function bindDesktopMenu(router: Router): () => void {
  const runtime = window.runtime;
  if (!runtime?.EventsOn) return () => {};

  const on = (event: string, run: (data: unknown) => void) =>
    runtime.EventsOn(event, (...data) => run(data[0]));

  const offs = [
    on('menu:navigate', (path) => {
      if (typeof path === 'string') void router.navigate(path);
    }),
    // Delta navigation, so Back after a menu jump still walks the history the
    // user actually built.
    on('menu:back', () => void router.navigate(-1)),
    on('menu:forward', () => void router.navigate(1)),
  ];

  return () => offs.forEach((off) => typeof off === 'function' && off());
}
