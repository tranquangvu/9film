import { useQuery } from '@tanstack/react-query';
import { translate } from '@/services/learn';
import { useSettings } from './use-settings-query';
import type { Word } from '@/services/user';

// Machine translation of a word/phrase. Translations are stable, so cache
// aggressively and let the backend absorb repeats. Pass null to skip the fetch.
export function useTranslateQuery(text: string | null, target = 'vi') {
  return useQuery({
    queryKey: ['translate', text, target],
    queryFn: ({ signal }) => translate(text!, target, signal),
    enabled: !!text,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

// The meaning to show for a saved word. Prefers the translation captured when
// the word was saved; falls back to a fresh lookup for words stored without one
// — imported starter packs, or a save that beat the in-player lookup.
export function useWordTranslation(word: Word): string {
  const { learningLang } = useSettings();
  const saved = word.translation?.trim() ?? '';
  const fetched = useTranslateQuery(saved ? null : word.word, learningLang);
  return saved || (fetched.data ?? '');
}
