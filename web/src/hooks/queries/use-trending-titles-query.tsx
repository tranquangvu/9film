import { useQuery } from '@tanstack/react-query';
import { getTrendingTitles } from '@/services/title';
import type { TitleDetail } from '@/utils/title';

export function useTrendingTitlesQuery<T = TitleDetail[]>(
  limit = 10,
  select?: (titles: TitleDetail[]) => T,
) {
  return useQuery({
    queryKey: ['titles', 'trending', limit],
    queryFn: ({ signal }) => getTrendingTitles(limit, signal),
    staleTime: 5 * 60 * 1000,
    select,
  });
}
