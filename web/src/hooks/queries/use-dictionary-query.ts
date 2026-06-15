import { useQuery } from '@tanstack/react-query';
import { getDictionary } from '@/services/dictionary';

// Dictionary entries are effectively immutable, so cache them hard and never
// refetch within a session.
export function useDictionaryQuery(word: string | undefined) {
  const key = (word ?? '').trim().toLowerCase();
  return useQuery({
    queryKey: ['dictionary', key],
    queryFn: ({ signal }) => getDictionary(key, signal),
    enabled: !!key,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
