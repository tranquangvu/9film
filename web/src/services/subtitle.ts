import type { SubtitleOption, SubtitleSearchContext } from '@/utils/subtitle';
import { isImdb } from '@/utils/stream';
import { apiFetch } from '@/lib/api-fetch';

function buildSearchQuery(ctx: SubtitleSearchContext): string | null {
  const { params, imdbId, languages = 'en' } = ctx;
  const q = new URLSearchParams({
    type: params.mediaType,
    languages,
  });

  if (imdbId) {
    q.set('imdb_id', imdbId);
  } else if (isImdb(params.mediaId)) {
    q.set('imdb_id', params.mediaId);
  } else if (/^\d+$/.test(params.mediaId)) {
    q.set('tmdb_id', params.mediaId);
  } else {
    return null;
  }

  if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
    q.set('season', String(params.season));
    q.set('episode', String(params.episode));
  }

  return q.toString();
}

export async function getSubtitles(
  ctx: SubtitleSearchContext,
  signal?: AbortSignal,
): Promise<SubtitleOption[]> {
  const query = buildSearchQuery(ctx);
  if (!query) return [];

  // Authed so the user's own OpenSubtitles key is used (falls back to .env).
  const json = await apiFetch<{ subtitles?: SubtitleOption[] }>(`/api/subtitle/search?${query}`, { signal });
  return json.subtitles ?? [];
}
