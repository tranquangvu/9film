import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWords,
  addWord,
  removeWord,
  completeWord,
  type Word,
} from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const WORDS_KEY = ['words'] as const;

export function useWordsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: WORDS_KEY,
    queryFn: getWords,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useIsWordSaved(word: string): boolean {
  const { data } = useWordsQuery();
  return (data ?? []).some((w) => w.word === word.toLowerCase());
}

type AddVars = Omit<Word, 'createdAt' | 'completedAt'>;

export function useAddWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (vars: AddVars) => addWord({ ...vars, word: vars.word.toLowerCase() }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: WORDS_KEY });
      const prev = qc.getQueryData<Word[]>(WORDS_KEY);
      const optimistic: Word = { ...vars, word: vars.word.toLowerCase() };
      qc.setQueryData<Word[]>(WORDS_KEY, (old = []) => [
        optimistic,
        ...old.filter((w) => w.word !== optimistic.word),
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(WORDS_KEY, ctx.prev);
      toast({ title: 'Could not save word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WORDS_KEY });
    },
  });
}

export function useRemoveWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (word: string) => removeWord(word.toLowerCase()),
    onMutate: async (word) => {
      await qc.cancelQueries({ queryKey: WORDS_KEY });
      const prev = qc.getQueryData<Word[]>(WORDS_KEY);
      qc.setQueryData<Word[]>(WORDS_KEY, (old = []) =>
        old.filter((w) => w.word !== word.toLowerCase()),
      );
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(WORDS_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WORDS_KEY });
    },
  });
}

// Marks a word learned. Optimistically stamps completedAt so the word moves
// from the added groups to the completed list without waiting on the refetch.
export function useCompleteWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (word: string) => completeWord(word.toLowerCase()),
    onMutate: async (word) => {
      await qc.cancelQueries({ queryKey: WORDS_KEY });
      const prev = qc.getQueryData<Word[]>(WORDS_KEY);
      const now = new Date().toISOString();
      qc.setQueryData<Word[]>(WORDS_KEY, (old = []) =>
        old.map((w) => (w.word === word.toLowerCase() ? { ...w, completedAt: now } : w)),
      );
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(WORDS_KEY, ctx.prev);
      toast({ title: 'Could not complete word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WORDS_KEY });
    },
  });
}
