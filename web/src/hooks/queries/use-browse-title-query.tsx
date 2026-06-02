import { useQuery } from '@tanstack/react-query';
import { browseTitles } from '@/services/title';
import type { BrowseResult } from '@/utils/title';

export function useBrowseTitleQuery<T = BrowseResult>(
  opts: {
    type?: string;
    genre?: string;
    first?: number;
    after?: string;
    minRating?: number;
    sort?: string;
  },
  select?: (data: BrowseResult) => T,
) {
  return useQuery({
    queryKey: ['titles', 'browse', opts],
    queryFn: ({ signal }) => browseTitles(opts, signal),
    staleTime: 5 * 60 * 1000,
    select,
  });
}
