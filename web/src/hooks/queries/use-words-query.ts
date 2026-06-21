import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  getWords,
  getWordStats,
  getWordImageObjectUrl,
  regenerateWordImage,
  importWordList,
  addWord,
  removeWord,
  completeWord,
  type Word,
  type WordImageStatus,
  type WordStat,
  type WordStatus,
} from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const STATS_KEY = ['word-stats'] as const;
// All paginated lists share the ['words', ...] prefix so a single
// invalidate({ queryKey: ['words'] }) refreshes every tab/list after a mutation.
const WORDS_PREFIX = ['words'] as const;
const wordsKey = (status: WordStatus, list: string) => ['words', list, status] as const;
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

// One tab+list's saved words, paginated for infinite scroll. While any loaded
// word's illustration is still generating, poll so the shimmer flips live.
export function useInfiniteWordsQuery(status: WordStatus, list = '') {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: wordsKey(status, list),
    queryFn: ({ pageParam }) => getWords(status, pageParam, WORDS_PAGE_SIZE, list),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      const pending = query.state.data?.pages.some((p) =>
        p.items.some((w) => w.imageStatus === 'pending'),
      );
      return pending ? 2500 : false;
    },
  });
}

// Resolves a word's AI illustration to an object URL. Enabled only when ready;
// keyed by the cache-bust token so a regeneration busts it. Revokes on cleanup.
export function useWordImage(word: string, status: WordImageStatus | undefined, updatedAt?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    let objectUrl: string | null = null;
    getWordImageObjectUrl(word, updatedAt)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u); // async callback, not a synchronous effect body call
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [word, status, updatedAt]);
  // Gate by status so a stale URL never shows once the word/state changes.
  return status === 'ready' ? url : null;
}

// Imports a bundled starter word list (e.g. Oxford 3000). Refreshes the lists
// and toasts how many were added.
export function useImportWordList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (list: string) => importWordList(list),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: STATS_KEY });
      qc.invalidateQueries({ queryKey: WORDS_PREFIX });
      toast({
        title: res.added > 0 ? `Added ${res.added} words` : 'Already imported',
        description: res.added > 0 ? 'Find them under To Learn.' : 'These words are already in your list.',
      });
    },
    onError: () => toast({ title: 'Could not import word list', description: 'Please try again.', variant: 'destructive' }),
  });
}

// Triggers (re)generation; flips the word back to pending so polling resumes.
export function useRegenerateWordImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (word: string) => regenerateWordImage(word.toLowerCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WORDS_PREFIX });
    },
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
        { word, completedAt: '', list: '' },
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
