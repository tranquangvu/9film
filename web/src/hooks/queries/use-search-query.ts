import { useQuery } from '@tanstack/react-query';
import { searchTitles } from '@/services/title';

export function useSearchQuery(q: string, limit = 20) {
  const term = q.trim();
  return useQuery({
    queryKey: ['titles', 'search', term, limit],
    queryFn: ({ signal }) => searchTitles(term, limit, signal),
    enabled: term.length > 0,
    staleTime: 60 * 1000,
  });
}
