import { useQueries } from '@tanstack/react-query';
import { getTitle } from '@/services/title';
import { normId, toTitle } from '@/utils/title';
import type { Title } from '@/types';

export function useTitlesQuery<T = Title[]>(
  ids: string[],
  options?: { select?: (titles: Title[]) => T },
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
      const titles = results
        .map((q) => (q.data ? toTitle(q.data) : null))
        .filter(Boolean) as Title[];
      return {
        data: (select ? select(titles) : titles) as T,
        loading: results.some((q) => q.isLoading),
        isError: results.some((q) => q.isError),
      };
    },
  });
}
