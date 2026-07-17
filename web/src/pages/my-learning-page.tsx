import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  BookOpen,
  Trophy,
  Flame,
  GraduationCap,
  Sparkles,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Brain,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import {
  useWordStatsQuery,
  useInfiniteWordsQuery,
  useImportWordList,
  useDueCount,
} from '@/hooks/queries/use-words-query';
import { normId } from '@/utils/title';
import { LoadMoreIndicator } from '@/components/system/common/load-more-indicator';
import { FlashcardDeck } from '@/components/system/learn/flashcard-deck';
import { SECTION_SIZE } from '@/components/system/learn/section-break';
import { WordTest } from '@/components/system/learn/word-test';
import { ReviewDeck } from '@/components/system/learn/review-deck';
import type { Word, WordStat } from '@/services/user';
import { parseDate, dayKey } from '@/utils/word';

// Consecutive days (ending today or yesterday) with at least one word added or
// completed — a light "keep the streak" motivator in the hero.
function computeStreak(words: WordStat[]): number {
  const days = new Set<string>();
  for (const w of words) {
    const a = parseDate(w.createdAt);
    if (a) days.add(dayKey(a));
    const c = parseDate(w.completedAt);
    if (c) days.add(dayKey(c));
  }
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// One shared pill style for every hero action, so the four buttons match in
// shape, size, spacing, and hover. Review (and Study when nothing is due) use the
// primary variant; the rest are neutral. All hover via the same bg transition.
const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors';
const PILL_NEUTRAL = 'border-white/15 bg-white/5 text-white hover:bg-white/10';
const PILL_PRIMARY =
  'border-orange-400/40 bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600';

// Playful header: a bouncing mascot, the title, and bubbly stat pills.
function LearningHero({
  title,
  subtitle,
  mascot,
  addedCount,
  streak,
  dueCount,
  onStudy,
  onReview,
  insightsTo,
  testsTo,
}: {
  title: string;
  subtitle: string;
  mascot: string;
  addedCount: number;
  streak: number;
  dueCount: number;
  onStudy: () => void;
  onReview: () => void;
  insightsTo?: string;
  testsTo: string;
}) {
  // Studying/reviewing runs in sections of SECTION_SIZE, so when there are more
  // words than one section the button advertises the batch size (10), not the
  // full backlog — otherwise "Study 14 words" misleads about the session length.
  const studyCount = Math.min(addedCount, SECTION_SIZE);
  const reviewCount = Math.min(dueCount, SECTION_SIZE);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 md:p-8">
      <div className="flex items-center gap-4">
        {mascot && (
          <motion.div
            className="text-5xl md:text-6xl select-none"
            initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          >
            {mascot}
          </motion.div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-emerald-100/70">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {/* All four actions share one pill style + hover; Review is the primary
            (orange) variant, the rest are neutral. */}
        {dueCount > 0 && (
          <button type="button" onClick={onReview} className={`${PILL} ${PILL_PRIMARY}`}>
            <Brain className="w-4 h-4" /> Review {dueCount > SECTION_SIZE ? 'next ' : ''}{reviewCount} {reviewCount === 1 ? 'word' : 'words'}
          </button>
        )}
        {addedCount > 0 && (
          <button
            type="button"
            onClick={onStudy}
            className={`${PILL} ${dueCount > 0 ? PILL_NEUTRAL : PILL_PRIMARY}`}
          >
            <GraduationCap className="w-4 h-4" /> Study {addedCount > SECTION_SIZE ? 'next ' : ''}{studyCount} {studyCount === 1 ? 'word' : 'words'}
          </button>
        )}
        <Link to={testsTo} className={`${PILL} ${PILL_NEUTRAL}`}>
          <ClipboardList className="w-4 h-4" /> Test results
        </Link>
        {insightsTo && (
          <Link to={insightsTo} className={`${PILL} ${PILL_NEUTRAL}`}>
            <BarChart3 className="w-4 h-4" /> Insights
          </Link>
        )}
      </div>

      {streak > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" /> {streak}-day streak
          </span>
        </div>
      )}
    </div>
  );
}


interface TitleGroup {
  imdbId: string; // '' = saved without a source title (e.g. imported packs)
  title: string; // stored source name ('' when unknown / legacy)
  words: Word[];
  recent: number; // most recent word time, for ordering groups
}

// Group a word list by the movie/show it was saved from, using the title name
// stored on each word (no IMDb fetch). Words sharing an id land together;
// source-less words (imported packs) collapse into one bucket that always sorts
// last. Within a group, and across groups, the most recently touched words come
// first.
function groupByTitle(words: Word[], dateOf: (w: Word) => string | undefined): TitleGroup[] {
  const ts = (w: Word) => parseDate(dateOf(w))?.getTime() ?? 0;
  const map = new Map<string, TitleGroup>();
  for (const w of words) {
    const key = w.imdbId || '';
    const entry = map.get(key);
    if (entry) {
      entry.words.push(w);
      if (!entry.title && w.title) entry.title = w.title;
    } else {
      map.set(key, { imdbId: key, title: w.title ?? '', words: [w], recent: 0 });
    }
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.words.sort((a, b) => ts(b) - ts(a));
    g.recent = ts(g.words[0]);
  }
  return groups.sort((a, b) => {
    if (!a.imdbId !== !b.imdbId) return a.imdbId ? -1 : 1;
    return b.recent - a.recent;
  });
}

function WordTitleGroupList({
  groups,
  onSelect,
  onTest,
}: {
  groups: TitleGroup[];
  onSelect: (w: Word) => void;
  onTest?: (g: TitleGroup, label: string) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const label = g.title || g.imdbId || 'Saved words';
        return (
          <motion.div key={g.imdbId || 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              {g.imdbId ? (
                <Link
                  to={`/title/${normId(g.imdbId)}`}
                  className="min-w-0 truncate text-sm font-medium text-zinc-200 hover:text-white"
                >
                  {label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-zinc-300">{label}</span>
              )}
              <span className="shrink-0 text-xs text-zinc-600">
                <span className="mr-2">|</span>
                {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
              </span>
              {onTest && (
                <button
                  onClick={() => onTest(g, label)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Test
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.words.map((w) => (
                <WordBadge key={w.word} word={w} onClick={() => onSelect(w)} />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function WordBadge({ word, onClick }: { word: Word; onClick: () => void }) {
  return (
    <Badge variant="tag" onClick={onClick} className="capitalize">
      {word.word}
    </Badge>
  );
}

// Promo card on the personal page that links to the dedicated Oxford 3000 page.
function StarterPack() {
  return (
    <div className="rounded-3xl border border-emerald-400/15 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-emerald-300" />
        <h2 className="text-sm font-semibold text-white">Starter packs</h2>
      </div>
      <Link
        to="/my-learning/the-oxford-3000"
        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:border-emerald-400/30 transition-colors"
      >
        <div className="text-4xl select-none">📚</div>
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-white">The Oxford 3000</p>
          <p className="text-sm text-zinc-400">The most important English words to know — open to add &amp; study them.</p>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
      </Link>
    </div>
  );
}

// Empty state for the Oxford 3000 page: one tap imports the whole list.
function OxfordImportCard() {
  const importList = useImportWordList();
  return (
    <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-transparent p-10 text-center">
      <div className="text-6xl mb-3 select-none">📚</div>
      <p className="font-bold text-white text-lg">The Oxford 3000</p>
      <p className="text-sm text-emerald-100/60 mt-1 mb-5">
        Add the 3000 most important English words, then study them as flashcards.
      </p>
      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
        <Button
          variant="primary"
          size="sm"
          disabled={importList.isPending}
          onClick={() => importList.mutate('oxford3000')}
        >
          <Plus className="w-4 h-4" />
          {importList.isPending ? 'Adding…' : 'Add the Oxford 3000'}
        </Button>
      </motion.div>
    </div>
  );
}

export default function MyLearningPage({ list = '' }: { list?: string }) {
  const isOxford = list === 'oxford3000';
  const { isAuthenticated } = useAuth();
  const stats = useWordStatsQuery();
  const [selected, setSelected] = useState<Word | null>(null);
  const [tab, setTab] = useState<'learn' | 'completed'>('learn');
  const [studying, setStudying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // The completed-date group currently being self-tested (null = no test open).
  const [testGroup, setTestGroup] = useState<{ words: Word[]; label: string } | null>(null);

  // Stats cover the whole vocabulary; this page only shows its own list.
  const all = useMemo(
    () => (stats.data ?? []).filter((w) => (w.list ?? '') === list),
    [stats.data, list],
  );
  const addedCount = useMemo(() => all.filter((w) => !w.completedAt).length, [all]);
  const completedCount = useMemo(() => all.filter((w) => w.completedAt).length, [all]);
  const streak = useMemo(() => computeStreak(all), [all]);
  // SRS reviews are global (any list); surface them on the main page only.
  const dueCount = useDueCount();

  // The active tab's words (rendered list). The "learn" set also feeds the deck;
  // when tab is "learn" this is the same cached query, so no double fetch.
  const tabQuery = useInfiniteWordsQuery(tab, list);
  const words = useMemo(() => tabQuery.data?.pages.flatMap((p) => p.items) ?? [], [tabQuery.data]);
  // Imported lists' To-Learn tab is a flat alphabetical list (no day grouping,
  // since they're all added at once); everything else groups by day.
  const flat = isOxford && tab === 'learn';
  const groups = useMemo(
    () => (flat ? [] : groupByTitle(words, (w) => (tab === 'learn' ? w.createdAt : w.completedAt))),
    [words, tab, flat],
  );

  // Words the flashcard deck studies — always the "to learn" set. The deck pulls
  // more pages as it progresses, so a large imported list (Oxford 3000) is fully
  // studyable without loading everything up front.
  const learnList = useInfiniteWordsQuery('learn', list);
  const learnWords = useMemo(() => learnList.data?.pages.flatMap((p) => p.items) ?? [], [learnList.data]);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 text-center text-zinc-400">
        <p>
          Please <Link to="/login" className="text-orange-400">sign in</Link> to use your vocabulary.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950/40 via-background to-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        {isOxford && (
          <Link to="/my-learning" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-4">
            <ChevronLeft className="w-4 h-4" /> My Learning
          </Link>
        )}
        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          isOxford ? (
            <OxfordImportCard />
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-transparent p-10 text-center">
                <div className="text-6xl mb-3 select-none">🌱</div>
                <p className="font-bold text-white text-lg">Your garden is empty</p>
                <p className="text-sm text-emerald-100/60 mt-1">Click a word in the subtitles while watching — or start with a pack below.</p>
              </div>
              <StarterPack />
            </div>
          )
        ) : (
          <div className="space-y-6">
            <LearningHero
              title={isOxford ? 'The Oxford 3000' : 'Vocabulary Garden'}
              subtitle={isOxford ? 'The essential English words — learn them as flashcards.' : 'Grow your words — one flashcard at a time.'}
              mascot={isOxford ? '📚' : ''}
              addedCount={addedCount}
              streak={streak}
              dueCount={isOxford ? 0 : dueCount}
              onStudy={() => setStudying(true)}
              onReview={() => setReviewing(true)}
              insightsTo={isOxford ? undefined : '/my-learning/insights'}
              testsTo="/my-learning/tests"
            />

            {!isOxford && <StarterPack />}

            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: 'learn', label: 'Study', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
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
                {(tabQuery.isLoading || isFetchingNextPage) && <LoadMoreIndicator className="mt-2" />}
                <div ref={sentinelRef} className="h-1" />
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {studying && (
          <FlashcardDeck
            words={learnWords}
            total={addedCount}
            hasMore={!!learnList.hasNextPage}
            fetchMore={learnList.fetchNextPage}
            onClose={() => setStudying(false)}
          />
        )}
      </AnimatePresence>

      {/* Tapping a word opens the same deck, parked on that word, over the tab's
          own list — so you can keep going from there rather than just read one. */}
      <AnimatePresence>
        {selected && (
          <FlashcardDeck
            words={words}
            total={tab === 'learn' ? addedCount : completedCount}
            hasMore={!!tabQuery.hasNextPage}
            fetchMore={tabQuery.fetchNextPage}
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

      <AnimatePresence>
        {reviewing && <ReviewDeck onClose={() => setReviewing(false)} />}
      </AnimatePresence>
    </div>
  );
}
