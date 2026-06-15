import { streamQuery, type EmbedParams, type StreamResponse } from '@/utils/stream';

export async function getStreamUrls(
  params: EmbedParams,
  signal?: AbortSignal,
): Promise<StreamResponse> {
  const query = streamQuery(params);
  const res = await fetch(`/api/stream?${query}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Stream API error: ${res.status}`);
  }

  // Read as text first so a non-JSON body (e.g. an upstream HTML error page)
  // surfaces a readable message instead of a raw "Unexpected token '<'" error.
  const text = await res.text();
  let json: {
    status_code?: string | number;
    data?: StreamResponse;
    message?: string;
  };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Stream is unavailable right now. Please try again later.');
  }

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
