// Free, key-less English dictionary (https://dictionaryapi.dev). It is public
// and CORS-enabled, so the browser can call it directly — no backend proxy.

export interface DictDefinition {
  definition: string;
  example?: string;
}

export interface DictMeaning {
  partOfSpeech: string;
  definitions: DictDefinition[];
}

export interface DictEntry {
  phonetic: string;
  meanings: DictMeaning[];
}

interface RawEntry {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
  }[];
}

// Returns null when the word has no entry (the API answers 404 in that case).
export async function getDictionary(word: string, signal?: AbortSignal): Promise<DictEntry | null> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
    { signal },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as RawEntry[];
  if (!Array.isArray(data) || data.length === 0) return null;

  // Phonetic: first non-empty across the top-level field or the phonetics list.
  let phonetic = '';
  for (const entry of data) {
    phonetic = entry.phonetic?.trim() || entry.phonetics?.find((p) => p.text?.trim())?.text?.trim() || '';
    if (phonetic) break;
  }

  const meanings: DictMeaning[] = [];
  for (const entry of data) {
    for (const m of entry.meanings ?? []) {
      const definitions = (m.definitions ?? [])
        .map((d) => ({ definition: d.definition ?? '', example: d.example }))
        .filter((d) => d.definition);
      if (m.partOfSpeech && definitions.length) {
        meanings.push({ partOfSpeech: m.partOfSpeech, definitions });
      }
    }
  }

  if (!meanings.length) return null;
  return { phonetic, meanings };
}
