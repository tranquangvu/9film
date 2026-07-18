import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCheck, GraduationCap, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/system/common/loading';
import { StudyDeck } from '@/components/system/learn/study-deck';
import { WordTest } from '@/components/system/learn/word-test';
import { WordBadge, WordTitleGroupList } from '@/components/system/learn/word-groups';
import { useInfiniteWordsQuery } from '@/hooks/queries/use-words-query';
import { groupByTitle } from '@/utils/word';
import type { Word } from '@/services/user';

// The Study / Completed tabs of one word list: the paginated word grid, the
// per-group self-test, and the flashcard deck a tapped word opens. Shared by the
// personal vocabulary page and the Oxford 3000 page — they differ only in
// `flatLearn` (imported packs list To-Learn alphabetically, ungrouped).
export function WordCollection({
  list = '',
  flatLearn = false,
  addedCount,
  completedCount,
}: {
  list?: string;
  flatLearn?: boolean;
  addedCount: number;
  completedCount: number;
}) {
  const [tab, setTab] = useState<'learn' | 'completed'>('learn');
  const [selected, setSelected] = useState<Word | null>(null);
  // The completed-date group currently being self-tested (null = no test open).
  const [testGroup, setTestGroup] = useState<{ words: Word[]; label: string } | null>(null);

  const tabQuery = useInfiniteWordsQuery(tab, list);
  const words = useMemo(() => tabQuery.data?.pages.flatMap((p) => p.items) ?? [], [tabQuery.data]);
  // Imported lists' To-Learn tab is a flat alphabetical list (no day grouping,
  // since they're all added at once); everything else groups by day.
  const flat = flatLearn && tab === 'learn';
  const groups = useMemo(
    () => (flat ? [] : groupByTitle(words, (w) => (tab === 'learn' ? w.createdAt : w.completedAt))),
    [words, tab, flat],
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = tabQuery;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: 'learn', label: 'Study', icon: <GraduationCap className="w-3.5 h-3.5" /> },
          { id: 'completed', label: 'Completed', icon: <CheckCheck className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <Badge variant="tag" key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </Badge>
        ))}
      </div>

      {tab === 'learn' && addedCount === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Trophy className="w-9 h-9 text-orange-400 mx-auto mb-2" />
          <p className="text-white font-medium">All caught up!</p>
          <p className="text-sm text-zinc-500 mt-1">Every saved word has been learned.</p>
        </div>
      ) : tab === 'completed' && completedCount === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <BookOpen className="w-9 h-9 text-zinc-600 mx-auto mb-2" />
          <p className="text-white font-medium">Nothing learned yet</p>
          <p className="text-sm text-zinc-500 mt-1">Study a word to move it here.</p>
        </div>
      ) : (
        <>
          {flat
            ? words.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {words.map((w) => (
                    <WordBadge key={w.word} word={w} onClick={() => setSelected(w)} />
                  ))}
                </div>
              )
            : groups.length > 0 && (
                <WordTitleGroupList
                  groups={groups}
                  onSelect={setSelected}
                  onTest={
                    tab === 'completed'
                      ? (g, label) => {
                          // Spelling a long idiom is harsh — test single words only.
                          const words = g.words.filter((w) => w.kind !== 'phrase');
                          if (words.length > 0) setTestGroup({ words, label });
                        }
                      : undefined
                  }
                />
              )}
          {(tabQuery.isLoading || isFetchingNextPage) && <Loading className="mt-2" />}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}

      {/* Tapping a word opens the same deck, parked on that word, over the tab's
          own list — so you can keep going from there rather than just read one. */}
      <AnimatePresence>
        {selected && (
          <StudyDeck
            words={words}
            total={tab === 'learn' ? addedCount : completedCount}
            hasMore={!!tabQuery.hasNextPage}
            fetchMore={tabQuery.fetchNextPage}
            loading={tabQuery.isLoading}
            startWord={selected.word}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {testGroup && (
          <WordTest
            words={testGroup.words}
            list={list}
            groupLabel={testGroup.label}
            onClose={() => setTestGroup(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
