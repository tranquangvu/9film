import type { Word } from '@/services/user';

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
