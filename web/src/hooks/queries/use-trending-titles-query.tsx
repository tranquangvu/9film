import { useQuery } from '@tanstack/react-query';
import { getTrendingTitles } from '@/services/title';
import type { Title } from '@/utils/title';

export function useTrendingTitlesQuery<T = Title[]>(
  limit = 10,
  select?: (titles: Title[]) => T,
) {
  return useQuery({
    queryKey: ['titles', 'trending', limit],
    queryFn: ({ signal }) => getTrendingTitles(limit, signal),
    staleTime: 5 * 60 * 1000,
    select,
  });
}
