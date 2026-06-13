// Persists the subtitle a user picked on the watch page, keyed by title, so it
// can be reselected when they return. We keep both the exact fileId (for the
// same release) and the language (a stable fallback across episodes/releases).

const KEY = 'nicefilm:subtitle-prefs';

export interface SubtitlePref {
  fileId: number;
  language: string;
}

type Store = Record<string, SubtitlePref>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

export function getSubtitlePref(titleId: string): SubtitlePref | null {
  return read()[titleId] ?? null;
}

export function setSubtitlePref(titleId: string, pref: SubtitlePref | null): void {
  const store = read();
  if (pref) store[titleId] = pref;
  else delete store[titleId];
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}
