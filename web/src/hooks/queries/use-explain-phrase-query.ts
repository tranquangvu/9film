import { useQuery } from '@tanstack/react-query';
import { explainPhrase } from '@/services/user';

// Explains a saved/selected phrase or idiom. The backend caches per user, so we
// cache aggressively here too. `enabled` only when there's a phrase to explain.
export function useExplainPhrase(phrase: string | null, sentence: string, target = 'vi') {
  return useQuery({
    queryKey: ['explain', phrase, sentence, target],
    queryFn: () => explainPhrase(phrase!, sentence, target),
    enabled: !!phrase,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
