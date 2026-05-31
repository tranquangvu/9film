import { useQuery } from '@tanstack/react-query';
import { fetchStreamUrls } from '@/services/stream';
import type { EmbedParams } from '@/utils/parse-embed-path';

export function useStreamQuery(params: EmbedParams | null) {
  return useQuery({
    queryKey: [
      'stream',
      params?.mediaId,
      params?.mediaType,
      params?.season ?? null,
      params?.episode ?? null,
    ],
    queryFn: ({ signal }) => fetchStreamUrls(params!, signal),
    enabled: !!params,
    staleTime: 5 * 60 * 1000,
  });
}
