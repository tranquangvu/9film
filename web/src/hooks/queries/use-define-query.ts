import { useQuery } from '@tanstack/react-query';
import { define } from '@/services/learn';

// Looks up a clicked word (definition + translation). Definitions are stable, so
// we cache aggressively and let the backend's 24h cache absorb repeats.
export function useDefineQuery(word: string | null, target = 'vi') {
  return useQuery({
    queryKey: ['define', word, target],
    queryFn: ({ signal }) => define(word!, target, signal),
    enabled: !!word,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
