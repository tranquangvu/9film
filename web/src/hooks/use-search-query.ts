import { useQuery } from '@tanstack/react-query';
import { fetchSearch } from '@/services/title';

export function useSearchTitles(q: string, limit = 20) {
  const term = q.trim();
  return useQuery({
    queryKey: ['titles', 'search', term, limit],
    queryFn: ({ signal }) => fetchSearch(term, limit, signal),
    enabled: term.length > 0,
    staleTime: 60 * 1000,
  });
}
