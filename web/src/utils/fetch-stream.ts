import { buildStreamQuery, type EmbedParams } from './parse-embed-path';
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

export async function fetchStreamUrls(params: EmbedParams): Promise<StreamResponse> {
  const query = buildStreamQuery(params);
  const res = await fetch(`/api/stream?${query}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Stream API error: ${res.status}`);
  }

  const json = (await res.json()) as {
    status_code?: string | number;
    data?: StreamResponse;
    message?: string;
  };

  if (String(json.status_code) !== '200' || !json.data) {
    throw new Error(json.message ?? 'Stream request failed');
  }

  const data = json.data;
  const hasStreams = (data.stream_urls?.length ?? 0) > 0;
  const hasEps = data.eps && Object.keys(data.eps).length > 0;

  if (!hasStreams && !hasEps) {
    throw new Error(json.message ?? 'No stream URLs returned');
  }

  return {
    ...data,
    stream_urls: data.stream_urls ?? [],
  };
}

export function pickBestStreamUrl(urls: string[]): string {
  if (!urls.length) return '';
  const adaptive = urls.find((u) => u.includes('master.m3u8'));
  if (adaptive) return adaptive;
  const compatible = urls.find((u) => !u.includes('justhd.tv'));
  return compatible ?? urls[0];
}
