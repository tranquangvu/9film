export type MediaType = 'tvseries' | 'movie';

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
  if (params.mediaType === 'tvseries' && params.season != null && params.episode != null) {
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
  if (params.mediaType !== 'tvseries' || (params.season != null && params.episode != null)) {
    return params;
  }
  const season = data.season != null ? Number(data.season) : undefined;
  const episode = data.episode != null ? Number(data.episode) : undefined;
  return season != null && episode != null ? { ...params, season, episode } : params;
}

export function bestUrl(urls: string[]): string {
  if (!urls.length) return '';
  return (
    urls.find((u) => u.includes('master.m3u8'))
    ?? urls.find((u) => !u.includes('justhd.tv'))
    ?? urls[0]
  );
}
