import { useSyncExternalStore } from 'react';

// Set once the welcome flow has been walked through: the licence notice read and
// the API keys either entered or knowingly skipped. Like the old watch notice it
// is a one-time statement of what the app is, so it lives in localStorage rather
// than the session.
const DONE_KEY = '9film:onboarded';

// A module-level store rather than per-component state: the gate wrapping the
// routes and the welcome page are different subtrees, and finishing in one has to
// unblock the other without a reload.
let done = localStorage.getItem(DONE_KEY) === '1';
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function isOnboarded() {
  return done;
}

export function completeOnboarding() {
  localStorage.setItem(DONE_KEY, '1');
  done = true;
  for (const l of listeners) l();
}

/** Reactive form of {@link isOnboarded} — re-renders when onboarding completes. */
export function useOnboarded() {
  return useSyncExternalStore(subscribe, isOnboarded);
}
