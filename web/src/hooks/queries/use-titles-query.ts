import { useQueries } from '@tanstack/react-query';
import { getTitle } from '@/services/title';
import { normId, toMovie } from '@/utils/title';
import type { Movie } from '@/types';

export function useTitlesQuery<T = Movie[]>(
  ids: string[],
  options?: { select?: (movies: Movie[]) => T },
) {
  const { select } = options ?? {};
  return useQueries({
    queries: ids.map((raw) => {
      const id = normId(raw);
      return {
        queryKey: ['title', id],
        queryFn: ({ signal }: { signal?: AbortSignal }) => getTitle(id, signal),
        staleTime: Infinity,
        enabled: !!id,
      };
    }),
    combine: (results) => {
      const movies = results
        .map((q) => (q.data ? toMovie(q.data) : null))
        .filter(Boolean) as Movie[];
      return {
        data: (select ? select(movies) : movies) as T,
        loading: results.some((q) => q.isLoading),
        isError: results.some((q) => q.isError),
      };
    },
  });
}
