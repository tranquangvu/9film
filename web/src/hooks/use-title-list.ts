import { useQueries } from '@tanstack/react-query';
import { fetchTitle } from '@/services/title';
import { normId, toMovie } from '@/utils/title';
import type { Movie } from '@/types';

export function useTitleList(ids: string[]) {
  const queries = useQueries({
    queries: ids.map((raw) => {
      const id = normId(raw);
      return {
        queryKey: ['title', id],
        queryFn: ({ signal }: { signal?: AbortSignal }) => fetchTitle(id, signal),
        staleTime: Infinity,
        enabled: !!id,
      };
    }),
  });

  const loading = queries.some((q) => q.isLoading);
  const movies: Movie[] = queries
    .map((q) => (q.data ? toMovie(q.data) : null))
    .filter(Boolean) as Movie[];

  return { movies, loading };
}
