import type { EpisodeMap } from './episodes';

export interface StreamResponse {
  title?: string;
  imdb_id?: string;
  season?: number | string;
  episode?: number | string;
  eps?: EpisodeMap;
  stream_urls: string[];
  backdrop?: string;
}


export function pickBestStreamUrl(urls: string[]): string {
  if (!urls.length) return '';
  const adaptive = urls.find((u) => u.includes('master.m3u8'));
  if (adaptive) return adaptive;
  const compatible = urls.find((u) => !u.includes('justhd.tv'));
  return compatible ?? urls[0];
}
