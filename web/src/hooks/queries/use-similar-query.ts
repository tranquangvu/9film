import { useQuery } from '@tanstack/react-query';
import { getSimilarTitles } from '@/services/title';
import { normId } from '@/utils/title';

export function useSimilarQuery(imdbId: string, limit = 5) {
  const id = normId(imdbId);
  return useQuery({
    queryKey: ['titles', 'similar', id, limit],
    queryFn: ({ signal }) => getSimilarTitles(id, limit, signal),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}
