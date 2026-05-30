export type MediaType = 'tv' | 'movie';

export interface EmbedParams {
  mediaType: MediaType;
  mediaId: string;
  season?: number;
  episode?: number;
}

const IMDB_ID_RE = /^tt\d+$/i;

/** Parse IMDb id from raw input (e.g. tt2575988 or 2575988). */
export function parseMediaId(input: string): string | null {
  const trimmed = input.trim();
  if (IMDB_ID_RE.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `tt${trimmed}`;
  return null;
}

export function isImdbId(mediaId: string): boolean {
  return IMDB_ID_RE.test(mediaId);
}

export function buildStreamQuery(params: EmbedParams): string {
  const q = new URLSearchParams({ type: params.mediaType });

  if (isImdbId(params.mediaId)) {
    q.set('imdb', params.mediaId);
  } else {
    q.set('tmdb', params.mediaId);
  }

  if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
    q.set('season', String(params.season));
    q.set('episode', String(params.episode));
  }
  return q.toString();
}
