import { buildStreamQuery, type EmbedParams } from '@/utils/parse-embed-path';
import type { StreamResponse } from '@/utils/fetch-stream';

export async function fetchStreamUrls(
  params: EmbedParams,
  signal?: AbortSignal,
): Promise<StreamResponse> {
  const query = buildStreamQuery(params);
  const res = await fetch(`/api/stream?${query}`, {
    headers: { Accept: 'application/json' },
    signal,
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
