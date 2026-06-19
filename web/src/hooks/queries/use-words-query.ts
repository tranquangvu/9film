import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getWords,
  getWordStats,
  addWord,
  removeWord,
  completeWord,
  type Word,
  type WordStat,
  type WordStatus,
} from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const STATS_KEY = ['word-stats'] as const;
// All paginated lists share the ['words', ...] prefix so a single
// invalidate({ queryKey: ['words'] }) refreshes every tab after a mutation.
const WORDS_PREFIX = ['words'] as const;
const wordsKey = (status: WordStatus) => ['words', status] as const;
const WORDS_PAGE_SIZE = 30;

// Lightweight full vocabulary: drives the progress chart, the to-learn/completed
// counts, and the saved-word lookup — all of which need every word, not a page.
export function useWordStatsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: getWordStats,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

// One tab's saved words, paginated for infinite scroll.
export function useInfiniteWordsQuery(status: WordStatus) {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: wordsKey(status),
    queryFn: ({ pageParam }) => getWords(status, pageParam, WORDS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useIsWordSaved(word: string): boolean {
  const { data } = useWordStatsQuery();
  return (data ?? []).some((w) => w.word === word.toLowerCase());
}

type AddVars = Omit<Word, 'createdAt' | 'completedAt'>;

export function useAddWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (vars: AddVars) => addWord({ ...vars, word: vars.word.toLowerCase() }),
    // Optimistically mark the word saved in the stats set so the in-player
    // "saved" badge flips instantly; the paginated lists refresh on settle.
    onMutate: async (vars) => {
      const word = vars.word.toLowerCase();
      await qc.cancelQueries({ queryKey: STATS_KEY });
      const prev = qc.getQueryData<WordStat[]>(STATS_KEY);
      qc.setQueryData<WordStat[]>(STATS_KEY, (old = []) => [
        { word, completedAt: '' },
        ...old.filter((w) => w.word !== word),
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(STATS_KEY, ctx.prev);
      toast({ title: 'Could not save word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: STATS_KEY });
      qc.invalidateQueries({ queryKey: WORDS_PREFIX });
    },
  });
}

export function useRemoveWord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (word: string) => removeWord(word.toLowerCase()),
    onMutate: async (word) => {
      const w = word.toLowerCase();
      await qc.cancelQueries({ queryKey: STATS_KEY });
      const prev = qc.getQueryData<WordStat[]>(STATS_KEY);
      qc.setQueryData<WordStat[]>(STATS_KEY, (old = []) => old.filter((x) => x.word !== w));
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(STATS_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: STATS_KEY });
      qc.invalidateQueries({ queryKey: WORDS_PREFIX });
    },
  });
}

// Marks a word learned. Optimistically stamps completedAt in the stats set so
// the chart and counts update immediately; both tab lists refetch on settle so
// the word moves from "To Learn" to "Completed".
export function useCompleteWord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (word: string) => completeWord(word.toLowerCase()),
    onMutate: async (word) => {
      const w = word.toLowerCase();
      await qc.cancelQueries({ queryKey: STATS_KEY });
      const prev = qc.getQueryData<WordStat[]>(STATS_KEY);
      const now = new Date().toISOString();
      qc.setQueryData<WordStat[]>(STATS_KEY, (old = []) =>
        old.map((x) => (x.word === w ? { ...x, completedAt: now } : x)),
      );
      return { prev };
    },
    onError: (_err, _word, ctx) => {
      if (ctx?.prev) qc.setQueryData(STATS_KEY, ctx.prev);
      toast({ title: 'Could not complete word', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: STATS_KEY });
      qc.invalidateQueries({ queryKey: WORDS_PREFIX });
    },
  });
}
