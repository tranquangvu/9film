import type { EmbedParams } from './stream';

const PREF_KEY = 'nicefilm:subtitle-prefs';

export interface SubtitleOption {
  // Opaque "<provider>:<ref>" handle minted by the backend (e.g. "subdl:/subtitle/x.zip").
  // Never parsed here — it just round-trips to /api/subtitle/download.
  id: string;
  language: string;
  label: string;
  // 0 for providers that publish no download count (SubDL). Informational only —
  // the list is never reordered by it.
  downloadCount: number;
  release: string;
}

export interface SubtitleSearchContext {
  params: EmbedParams;
  imdbId?: string;
  languages?: string;
}

// The provider's response, listed as-is: its own relevance order, every track it
// returned. No sorting by download count, no preferred-language pool, no
// release-name/BluRay heuristic, no top-N cut — the search is already scoped to
// one title, episode and language server-side, so anything we drop here is a
// track the user can no longer reach.
//
// The one thing removed is a repeated id: SubDL returns a row per release, but
// every row of a season pack points at the same archive and so collapses onto
// one id, which would mean duplicate keys and an ambiguous selection.
export function listSubs(subs: SubtitleOption[]): SubtitleOption[] {
  const seen = new Set<string>();
  return subs.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

// Persists the subtitle a user picked on the watch page, keyed by title, so it
// can be reselected when they return. We keep both the exact id (for the same
// release) and the language (a stable fallback across episodes/releases).

export interface SubtitlePref {
  id: string;
  language: string;
}

/** Prefs written before ids carried a provider hold a bare OpenSubtitles file id. */
type StoredPref = SubtitlePref | { fileId: number; language: string };

// A saved id that no longer resolves — an OpenSubtitles one, now that only SubDL
// is wired in — keeps its language, which is the half of the preference still
// worth honouring. No option ever has an empty id, so the id match just misses.
const UNRESOLVABLE_ID = '';

type PrefStore = Record<string, StoredPref>;

function readPrefs(): PrefStore {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as PrefStore;
  } catch {
    return {};
  }
}

// Migrated on read rather than in bulk; the store normalizes the next time it's
// written. A bare fileId was an OpenSubtitles track, which nothing can fetch
// anymore, so only its language carries over.
function migratePref(pref: StoredPref | undefined): SubtitlePref | null {
  if (!pref) return null;
  if ('id' in pref && typeof pref.id === 'string') return { id: pref.id, language: pref.language };
  if ('fileId' in pref && typeof pref.fileId === 'number') {
    return { id: UNRESOLVABLE_ID, language: pref.language };
  }
  return null;
}

export function getSubtitlePref(titleId: string): SubtitlePref | null {
  return migratePref(readPrefs()[titleId]);
}

export function setSubtitlePref(titleId: string, pref: SubtitlePref | null): void {
  const store = readPrefs();
  if (pref) store[titleId] = pref;
  else delete store[titleId];
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(store));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}
