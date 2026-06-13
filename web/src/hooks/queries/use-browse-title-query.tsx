import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { browseTitles } from '@/services/title';
import type { BrowseResult } from '@/utils/title';

export interface BrowseOpts {
  type?: string;
  genre?: string;
  first?: number;
  minRating?: number;
  sort?: string;
}

// Cursor-paginated browse feed. Each page carries the upstream endCursor; the
// next page is requested with `after`, stopping once hasNextPage is false.
export function useBrowseTitlesInfinite(opts: BrowseOpts, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['titles', 'browse', 'infinite', opts],
    queryFn: ({ pageParam, signal }) =>
      browseTitles({ ...opts, after: pageParam || undefined }, signal),
    initialPageParam: '',
    getNextPageParam: (last: BrowseResult) =>
      last.hasNextPage && last.endCursor ? last.endCursor : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

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
  enabled = true,
) {
  return useQuery({
    queryKey: ['titles', 'browse', opts],
    queryFn: ({ signal }) => browseTitles(opts, signal),
    staleTime: 5 * 60 * 1000,
    select,
    enabled,
  });
}
