import type { StreamResponse } from './fetch-stream';
import type { EmbedParams } from './parse-embed-path';

/** Merge season/episode from stream API when params omit them (e.g. TV without S/E). */
export function mergeEpisodeFromStream(
  params: EmbedParams,
  data: Pick<StreamResponse, 'season' | 'episode'>,
): EmbedParams {
  if (params.mediaType !== 'tv') return params;
  if (params.season != null && params.episode != null) return params;

  const season = data.season != null ? Number(data.season) : undefined;
  const episode = data.episode != null ? Number(data.episode) : undefined;
  if (season == null || episode == null) return params;

  return { ...params, season, episode };
}
