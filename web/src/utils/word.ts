import type { Word, WordStat } from '@/services/user';

// Deterministic 32-bit string hash (FNV-1a style) — stable and well spread.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Spread the hue across the full 360° wheel using the golden-angle conjugate.
// Multiplying the hash by ~0.618 turns of the circle scatters even very similar
// inputs far apart, so neighbouring words rarely land on look-alike hues.
const GOLDEN_ANGLE = 0.618033988749895;

// A stable, "random" colour for a saved word. Deriving the hue from the string
// itself (instead of storing one) keeps it consistent across reloads and devices
// with zero backend changes — the same string always gets the same hue.
export function wordColor(word: string): string {
  const n = hash(word.trim().toLowerCase());
  const h = Math.round(((n * GOLDEN_ANGLE) % 1) * 360);
  // Nudge saturation/lightness from independent hash bits so two words that
  // happen to share a hue still read as visibly different.
  const s = 70 + ((n >>> 8) % 22); // 70–91%
  const l = 70 + ((n >>> 16) % 14); // 70–83%
  return `hsl(${h} ${Math.min(s + 5, 95)}% ${l}%)`;
}

// SQLite stamps are UTC "YYYY-MM-DD HH:MM:SS"; optimistic stamps are ISO. Parse
// both so saved-word timestamps can be bucketed by the viewer's local day.
export function parseDate(s?: string): Date | null {
  if (!s) return null;
  const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Consecutive days (ending today or yesterday) with at least one word added or
// completed — a light "keep the streak" motivator in the learning hero.
export function computeStreak(words: WordStat[]): number {
  const days = new Set<string>();
  for (const w of words) {
    const a = parseDate(w.createdAt);
    if (a) days.add(dayKey(a));
    const c = parseDate(w.completedAt);
    if (c) days.add(dayKey(c));
  }
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export interface TitleGroup {
  imdbId: string; // '' = saved without a source title (e.g. imported packs)
  title: string; // stored source name ('' when unknown / legacy)
  words: Word[];
  recent: number; // most recent word time, for ordering groups
}

// Group a word list by the movie/show it was saved from, using the title name
// stored on each word (no IMDb fetch). Words sharing an id land together;
// source-less words (imported packs) collapse into one bucket that always sorts
// last. Within a group, and across groups, the most recently touched words come
// first.
export function groupByTitle(words: Word[], dateOf: (w: Word) => string | undefined): TitleGroup[] {
  const ts = (w: Word) => parseDate(dateOf(w))?.getTime() ?? 0;
  const map = new Map<string, TitleGroup>();
  for (const w of words) {
    const key = w.imdbId || '';
    const entry = map.get(key);
    if (entry) {
      entry.words.push(w);
      if (!entry.title && w.title) entry.title = w.title;
    } else {
      map.set(key, { imdbId: key, title: w.title ?? '', words: [w], recent: 0 });
    }
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.words.sort((a, b) => ts(b) - ts(a));
    g.recent = ts(g.words[0]);
  }
  return groups.sort((a, b) => {
    if (!a.imdbId !== !b.imdbId) return a.imdbId ? -1 : 1;
    return b.recent - a.recent;
  });
}

// Deep link back to the exact scene a word was saved from. Season/episode are
// omitted for films, and the timestamp for words saved without one, so the URL
// stays as short as the context allows. Words with no imdbId (imported starter
// packs) have no scene to link to — callers guard on that.
export function sceneLink(w: Word): string {
  const params = new URLSearchParams();
  if (w.season > 0) params.set('s', String(w.season));
  if (w.episode > 0) params.set('e', String(w.episode));
  if (w.timestamp > 0) params.set('t', String(Math.floor(w.timestamp)));
  const qs = params.toString();
  return `/watch/${w.imdbId}${qs ? `?${qs}` : ''}`;
}

// How many retyped attempts match the word. Comparison is trimmed and
// case-insensitive, so casing never fails an otherwise right answer.
export function spelledCount(word: string, attempts: string[]): number {
  const target = word.trim().toLowerCase();
  if (target === '') return 0;
  return attempts.filter((s) => s.trim().toLowerCase() === target).length;
}

// Whether every box matches — the gate the word dialog's "Complete" and the
// study deck's "Got it" both unlock on.
export function isSpelled(word: string, attempts: string[]): boolean {
  return attempts.length > 0 && spelledCount(word, attempts) === attempts.length;
}
