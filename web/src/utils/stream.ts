export type MediaType = 'tv' | 'movie';

export interface EmbedParams {
  mediaType: MediaType;
  mediaId: string;
  season?: number;
  episode?: number;
}

const IMDB_RE = /^tt\d+$/i;

export function parseId(input: string): string | null {
  const s = input.trim();
  if (IMDB_RE.test(s)) return s;
  if (/^\d+$/.test(s)) return `tt${s}`;
  return null;
}

export function isImdb(id: string): boolean {
  return IMDB_RE.test(id);
}

export function streamQuery(params: EmbedParams): string {
  const q = new URLSearchParams({ type: params.mediaType });
  q.set(isImdb(params.mediaId) ? 'imdb' : 'tmdb', params.mediaId);
  if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
    q.set('season', String(params.season));
    q.set('episode', String(params.episode));
  }
  return q.toString();
}

export type EpisodeMap = Record<string, string[]>;

export function seasons(eps: EpisodeMap): number[] {
  return Object.keys(eps).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}

export function episodes(eps: EpisodeMap, season: number): number[] {
  return (eps[String(season)] ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}

export interface StreamResponse {
  title?: string;
  imdb_id?: string;
  season?: number | string;
  episode?: number | string;
  eps?: EpisodeMap;
  stream_urls: string[];
  backdrop?: string;
}

export function mergeEpisode(
  params: EmbedParams,
  data: Pick<StreamResponse, 'season' | 'episode'>,
): EmbedParams {
  if (params.mediaType !== 'tv' || (params.season != null && params.episode != null)) {
    return params;
  }
  const season = data.season != null ? Number(data.season) : undefined;
  const episode = data.episode != null ? Number(data.episode) : undefined;
  return season != null && episode != null ? { ...params, season, episode } : params;
}

export function bestUrl(urls: string[], preferredQuality?: string): string {
  if (!urls.length) return '';
  // Honor an explicit quality preference (e.g. '1080', '720') when a stream URL
  // advertises it; 'auto'/unset falls through to the adaptive master playlist.
  if (preferredQuality && preferredQuality !== 'auto') {
    const q = preferredQuality.replace(/\D/g, '');
    if (q) {
      const match = urls.find((u) => u.includes(q));
      if (match) return match;
    }
  }
  return (
    urls.find((u) => u.includes('master.m3u8'))
    ?? urls.find((u) => !u.includes('justhd.tv'))
    ?? urls[0]
  );
}
