import type { SubtitleOption, SubtitleSearchContext } from '@/utils/subtitle';
import { isImdb } from '@/utils/stream';

function normalizeLanguage(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (trimmed === 'vn') return 'vi';
  return trimmed;
}

function buildSearchQuery(ctx: SubtitleSearchContext): string | null {
  const { params, imdbId, languages = 'en' } = ctx;
  const q = new URLSearchParams({
    type: params.mediaType,
    languages: normalizeLanguage(languages),
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

export async function fetchSubtitles(
  ctx: SubtitleSearchContext,
  signal?: AbortSignal,
): Promise<SubtitleOption[]> {
  const query = buildSearchQuery(ctx);
  if (!query) return [];

  const res = await fetch(`/api/subtitle/search?${query}`, { signal });
  const json = (await res.json()) as {
    subtitles?: SubtitleOption[];
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? `Subtitle search failed (${res.status})`);
  }

  return json.subtitles ?? [];
}
