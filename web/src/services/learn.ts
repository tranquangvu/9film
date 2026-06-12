// Client for the public /api/learn/* helpers (English dictionary + translation).
// These need no auth, so they use plain fetch rather than apiFetch.

export interface DefinitionEntry {
  definition: string;
  example: string;
}

export interface Meaning {
  partOfSpeech: string;
  definitions: DefinitionEntry[];
}

export interface Definition {
  word: string;
  phonetic: string;
  audioUrl: string;
  meanings: Meaning[];
}

export interface DefineResult {
  word: string;
  definition: Definition | null; // null when the word has no dictionary entry
  translation: string; // target-language translation of the word
}

export async function define(word: string, target = 'vi', signal?: AbortSignal): Promise<DefineResult> {
  const q = new URLSearchParams({ word, target });
  const res = await fetch(`/api/learn/define?${q}`, { signal });
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  return res.json();
}

export async function translate(text: string, target = 'vi', signal?: AbortSignal): Promise<string> {
  const q = new URLSearchParams({ q: text, target });
  const res = await fetch(`/api/learn/translate?${q}`, { signal });
  if (!res.ok) throw new Error(`Translation failed (${res.status})`);
  const data = (await res.json()) as { translation?: string };
  return data.translation ?? '';
}
