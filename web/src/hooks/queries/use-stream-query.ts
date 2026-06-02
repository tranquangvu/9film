import { useQuery } from '@tanstack/react-query';
import { getStreamUrls } from '@/services/stream';
import type { EmbedParams } from '@/utils/stream';

export function useStreamQuery(params: EmbedParams | null) {
  return useQuery({
    queryKey: [
      'stream',
      params?.mediaId,
      params?.mediaType,
      params?.season ?? null,
      params?.episode ?? null,
    ],
    queryFn: ({ signal }) => getStreamUrls(params!, signal),
    enabled: !!params,
    staleTime: 5 * 60 * 1000,
  });
}
