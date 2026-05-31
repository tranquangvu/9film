import { useQuery } from '@tanstack/react-query';
import { fetchSimilar } from '@/services/title';
import { normId } from '@/utils/title';

export function useSimilarTitles(imdbId: string, limit = 6) {
  const id = normId(imdbId);
  return useQuery({
    queryKey: ['titles', 'similar', id, limit],
    queryFn: ({ signal }) => fetchSimilar(id, limit, signal),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}
