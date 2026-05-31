import type { ImdbTitle, OriginalLanguage } from '@/utils/imdb';
import { normalizeImdbId, originalLanguageFromTitle } from '@/utils/imdb';

export async function fetchTitle(imdbId: string, signal?: AbortSignal): Promise<ImdbTitle> {
  const id = encodeURIComponent(normalizeImdbId(imdbId));
  const res = await fetch(`/api/title/${id}`, { signal });
  const json = (await res.json()) as ImdbTitle & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Title details failed (${res.status})`);
  }

  if (!json.id) {
    throw new Error('No title details returned');
  }

  return json;
}

export async function fetchOriginalLanguage(
  imdbId: string,
  signal?: AbortSignal,
): Promise<OriginalLanguage> {
  const title = await fetchTitle(imdbId, signal);
  return originalLanguageFromTitle(title);
}
