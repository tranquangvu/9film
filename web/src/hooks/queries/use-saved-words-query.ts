import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSavedWords,
  addSavedWord,
  removeSavedWord,
  completeSavedWord,
  type SavedWord,
} from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const SAVED_WORDS_KEY = ['saved-words'] as const;

export function useSavedWordsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: SAVED_WORDS_KEY,
    queryFn: getSavedWords,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useIsWordSaved(word: string): boolean {
  const { data } = useSavedWordsQuery();
  return (data ?? []).some((w) => w.word === word.toLowerCase());
}

type AddVars = Omit<SavedWord, 'createdAt' | 'completedAt'>;

export function useAddSavedWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (vars: AddVars) => addSavedWord({ ...vars, word: vars.word.toLowerCase() }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: SAVED_WORDS_KEY });
      const prev = qc.getQueryData<SavedWord[]>(SAVED_WORDS_KEY);
      const optimistic: SavedWord = { ...vars, word: vars.word.toLowerCase() };
      qc.setQueryData<SavedWord[]>(SAVED_WORDS_KEY, (old = []) => [
        optimistic,
        ...old.filter((w) => w.word !== optimistic.word),
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(SAVED_WORDS_KEY, ctx.prev);
      toast({ title: 'Could not save word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_WORDS_KEY });
    },
  });
}

export function useRemoveSavedWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (word: string) => removeSavedWord(word.toLowerCase()),
    onMutate: async (word) => {
      await qc.cancelQueries({ queryKey: SAVED_WORDS_KEY });
      const prev = qc.getQueryData<SavedWord[]>(SAVED_WORDS_KEY);
      qc.setQueryData<SavedWord[]>(SAVED_WORDS_KEY, (old = []) =>
        old.filter((w) => w.word !== word.toLowerCase()),
      );
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(SAVED_WORDS_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_WORDS_KEY });
    },
  });
}

// Marks a word learned. Optimistically stamps completedAt so the word moves
// from the added groups to the completed list without waiting on the refetch.
export function useCompleteSavedWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (word: string) => completeSavedWord(word.toLowerCase()),
    onMutate: async (word) => {
      await qc.cancelQueries({ queryKey: SAVED_WORDS_KEY });
      const prev = qc.getQueryData<SavedWord[]>(SAVED_WORDS_KEY);
      const now = new Date().toISOString();
      qc.setQueryData<SavedWord[]>(SAVED_WORDS_KEY, (old = []) =>
        old.map((w) => (w.word === word.toLowerCase() ? { ...w, completedAt: now } : w)),
      );
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(SAVED_WORDS_KEY, ctx.prev);
      toast({ title: 'Could not complete word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SAVED_WORDS_KEY });
    },
  });
}
