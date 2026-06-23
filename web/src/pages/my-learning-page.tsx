import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Volume2,
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
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/auth-context';
import {
  useWordStatsQuery,
  useInfiniteWordsQuery,
  useWordImage,
  useImportWordList,
  useCompleteWord,
  useDueCount,
} from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { useExplainPhrase } from '@/hooks/queries/use-explain-phrase-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import { LoadMoreIndicator } from '@/components/system/common/load-more-indicator';
import { FlashcardDeck } from '@/components/system/learn/flashcard-deck';
import { WordTest } from '@/components/system/learn/word-test';
import { ReviewDeck } from '@/components/system/learn/review-deck';
import { parseDate, dayKey } from '@/utils/word-date';
import type { Word, WordStat } from '@/services/user';

function friendlyDay(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Build a deep link back to the exact scene the word was saved from.
function sceneLink(w: Word): string {
  const params = new URLSearchParams();
  if (w.season > 0) params.set('s', String(w.season));
  if (w.episode > 0) params.set('e', String(w.episode));
  if (w.timestamp > 0) params.set('t', String(Math.floor(w.timestamp)));
  const qs = params.toString();
  return `/watch/${w.imdbId}${qs ? `?${qs}` : ''}`;
}

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

// Playful header: a bouncing mascot, the title, and bubbly stat pills.
function LearningHero({
  title,
  subtitle,
  mascot,
  addedCount,
  completedCount,
  streak,
  dueCount,
  onStudy,
  onReview,
  insightsTo,
}: {
  title: string;
  subtitle: string;
  mascot: string;
  addedCount: number;
  completedCount: number;
  streak: number;
  dueCount: number;
  onStudy: () => void;
  onReview: () => void;
  insightsTo?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 md:p-8">
      <div className="flex items-center gap-4">
        <motion.div
          className="text-5xl md:text-6xl select-none"
          initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        >
          {mascot}
        </motion.div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-emerald-100/70">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 px-3 py-1.5 text-sm font-semibold text-emerald-200">
          <BookOpen className="w-4 h-4" /> {addedCount} to learn
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-400/25 px-3 py-1.5 text-sm font-semibold text-orange-200">
          <CheckCircle2 className="w-4 h-4" /> {completedCount} learned
        </span>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-sm font-semibold text-white">
            <Flame className="w-4 h-4 text-orange-400" /> {streak}-day streak
          </span>
        )}
        {dueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-400/25 px-3 py-1.5 text-sm font-semibold text-sky-200">
            <Brain className="w-4 h-4" /> {dueCount} due for review
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {dueCount > 0 && (
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="primary" size="lg" className="rounded-2xl" onClick={onReview}>
              <Brain className="w-5 h-5" /> Review {dueCount} {dueCount === 1 ? 'word' : 'words'}
            </Button>
          </motion.div>
        )}
        {addedCount > 0 && (
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant={dueCount > 0 ? 'outline' : 'primary'} size="lg" className="rounded-2xl" onClick={onStudy}>
              <GraduationCap className="w-5 h-5" /> Study {addedCount} {addedCount === 1 ? 'word' : 'words'}
            </Button>
          </motion.div>
        )}
        {insightsTo && (
          <Link
            to={insightsTo}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <BarChart3 className="w-4 h-4" /> Insights
          </Link>
        )}
      </div>
    </div>
  );
}

const SPELL_TIMES = 8; // times the word must be retyped to mark it complete

function WordDialog({
  word,
  onOpenChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onComplete,
  completing,
}: {
  word: Word | null;
  onOpenChange: (open: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onComplete: (w: Word) => void;
  completing: boolean;
}) {
  const isPhrase = word?.kind === 'phrase';
  const dict = useDictionaryQuery(isPhrase ? undefined : word?.word);
  const explain = useExplainPhrase(isPhrase ? (word?.word ?? null) : null, word?.sentence ?? '');
  const imageUrl = useWordImage(word?.word ?? '', word?.imageStatus, word?.imageUpdatedAt);

  const openWord = word?.word;
  useEffect(() => {
    if (openWord) speak(openWord);
  }, [openWord]);

  const isDone = !!word?.completedAt;

  // To complete a word, the learner retypes it SPELL_TIMES times; each box
  // pronounces the word on focus. The "Complete" button unlocks only when all
  // attempts match. State resets whenever a different word is opened.
  const [spellings, setSpellings] = useState<string[]>(() => Array(SPELL_TIMES).fill(''));
  useEffect(() => {
    setSpellings(Array(SPELL_TIMES).fill(''));
  }, [openWord]);
  const target = (openWord ?? '').trim().toLowerCase();
  const allSpelled = target !== '' && spellings.every((s) => s.trim().toLowerCase() === target);

  return (
    <Dialog open={!!word} onOpenChange={onOpenChange}>
      <DialogContent>
        {word && (
          <div>
            {word.imageStatus === 'ready' && imageUrl && (
              <div className="mb-4 w-full aspect-[16/9] rounded-2xl overflow-hidden bg-white">
                <img src={imageUrl} alt={word.word} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex items-center gap-3 pr-8">
              <DialogTitle className="capitalize" style={{ color: wordColor(word.word).color }}>
                {word.word}
              </DialogTitle>
              {canSpeak() && (
                <button onClick={() => speak(word.word)} aria-label="Pronounce word" className="shrink-0 text-orange-400 hover:text-orange-300 transition-colors">
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
              {isDone && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-orange-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
              )}
            </div>

            {dict.data?.phonetic && <p className="mt-1 text-sm text-zinc-500">{dict.data.phonetic}</p>}

            {word.translation && <p className="mt-2 text-orange-300 font-medium">{word.translation}</p>}
            {word.sentence && (
              <div className="mt-2 flex items-start gap-2">
                <DialogDescription className="italic text-zinc-400">“{word.sentence}”</DialogDescription>
                {canSpeak() && (
                  <button onClick={() => speak(word.sentence)} aria-label="Read sentence aloud" className="shrink-0 mt-1 text-orange-400 hover:text-orange-300 transition-colors">
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {word.imdbId && (
              <Link to={sceneLink(word)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300" target="_blank">
                <Play className="w-3.5 h-3.5" /> Watch the scene
              </Link>
            )}

            {isPhrase && (
              <div className="mt-4 space-y-3">
                {explain.isLoading && <p className="text-sm text-zinc-600">Explaining…</p>}
                {explain.data?.literal && <ExplainBlock label="Literally" text={explain.data.literal} />}
                {explain.data?.figurative && <ExplainBlock label="Figuratively" text={explain.data.figurative} />}
                {explain.data?.usage && <ExplainBlock label="Usage" text={explain.data.usage} />}
              </div>
            )}

            {!isPhrase && dict.isLoading && <p className="mt-4 text-sm text-zinc-600">Loading definitions…</p>}
            {!isPhrase && dict.data && (
              <div className="mt-4 space-y-3">
                {dict.data.meanings.slice(0, 4).map((m, i) => (
                  <div key={`${m.partOfSpeech}-${i}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{m.partOfSpeech}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {m.definitions.slice(0, 3).map((d, j) => (
                        <li key={j} className="text-sm text-zinc-200">
                          <span className="text-zinc-500 mr-1.5">•</span>
                          {d.definition}
                          {d.example && <span className="block pl-4 mt-0.5 text-zinc-500 italic">“{d.example}”</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {!isDone && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Type the word {SPELL_TIMES} times to complete
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {spellings.map((s, i) => {
                    const correct = s.trim().toLowerCase() === target;
                    return (
                      <div key={i} className="relative">
                        <input
                          value={s}
                          onChange={(e) =>
                            setSpellings((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                          }
                          onFocus={() => speak(word.word)}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder={`${i + 1}`}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-orange-400/60"
                        />
                        {s.trim() !== '' && correct && (
                          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onPrev} disabled={!hasPrev}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              {!isDone ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full"
                  disabled={completing || !allSpelled}
                  onClick={() => onComplete(word)}
                >
                  <CheckCircle2 className="w-4 h-4" /> {completing ? 'Saving…' : 'Complete'}
                </Button>
              ) : (
                <span className="text-xs text-orange-400 font-medium">Learned</span>
              )}
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onNext} disabled={!hasNext}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// One labelled line of a phrase explanation in the word detail dialog.
function ExplainBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{text}</p>
    </div>
  );
}

interface DayGroup {
  key: string;
  date: Date;
  words: Word[];
}

function groupByDay(words: Word[], dateOf: (w: Word) => string | undefined): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const w of words) {
    const d = parseDate(dateOf(w)) ?? new Date(0);
    const key = dayKey(d);
    const entry = map.get(key);
    if (entry) entry.words.push(w);
    else map.set(key, { key, date: d, words: [w] });
  }
  const ts = (w: Word) => parseDate(dateOf(w))?.getTime() ?? 0;
  const groups = [...map.values()];
  for (const g of groups) g.words.sort((a, b) => ts(b) - ts(a));
  return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function WordGroupList({
  groups,
  onSelect,
  onTest,
}: {
  groups: DayGroup[];
  onSelect: (w: Word) => void;
  onTest?: (g: DayGroup) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <motion.div key={g.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-zinc-300">{friendlyDay(g.date)}</span>
            <span className="text-xs text-zinc-600">
              <span className="mr-2">|</span>
              {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
            </span>
            {onTest && (
              <button
                onClick={() => onTest(g)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 transition-colors"
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
      ))}
    </div>
  );
}

// Each word carries its own stable, translucent color (derived from the word
// text) so the lists read as soft, colorful chips. A dot hints image state.
function WordBadge({ word, onClick }: { word: Word; onClick: () => void }) {
  const c = wordColor(word.word);
  return (
    <Badge
      variant="tag"
      onClick={onClick}
      style={{ background: c.background, borderColor: c.borderColor, color: c.color }}
      className="capitalize cursor-pointer hover:brightness-125"
    >
      {word.kind === 'phrase' ? (
        <span className="mr-1">💬</span>
      ) : (
        word.imageStatus === 'ready' && <span className="mr-1">🖼️</span>
      )}
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
          size="lg"
          className="rounded-2xl"
          disabled={importList.isPending}
          onClick={() => importList.mutate('oxford3000')}
        >
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
    () => (flat ? [] : groupByDay(words, (w) => (tab === 'learn' ? w.createdAt : w.completedAt))),
    [words, tab, flat],
  );

  // Words the flashcard deck studies — always the "to learn" set. The deck pulls
  // more pages as it progresses, so a large imported list (Oxford 3000) is fully
  // studyable without loading everything up front.
  const learnList = useInfiniteWordsQuery('learn', list);
  const learnWords = useMemo(() => learnList.data?.pages.flatMap((p) => p.items) ?? [], [learnList.data]);

  const selectedLive = selected ? (words.find((w) => w.word === selected.word) ?? selected) : null;

  // Navigation within the open word popup, across the loaded list.
  const selIdx = useMemo(
    () => (selected ? words.findIndex((w) => w.word === selected.word) : -1),
    [selected, words],
  );
  const complete = useCompleteWord();
  const gotoWord = (i: number) => {
    if (i >= 0 && i < words.length) setSelected(words[i]);
  };
  // Mark learned, then advance to the next word (or close when it was the last).
  const completeAndNext = (w: Word) => {
    const next = words[selIdx + 1] ?? null;
    complete.mutate(w.word, {
      onSuccess: () => setSelected(next && next.word !== w.word ? next : null),
    });
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = tabQuery;

  // Keep navigation flowing for large lists: load the next page as the open
  // word nears the end of what's loaded.
  useEffect(() => {
    if (selIdx >= 0 && selIdx >= words.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [selIdx, words.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
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
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-950/40 via-background to-background pt-24 pb-16 px-4 md:px-8 lg:px-12"
      style={{
        backgroundImage:
          'linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
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
              mascot={isOxford ? '📚' : '🐰'}
              addedCount={addedCount}
              completedCount={completedCount}
              streak={streak}
              dueCount={isOxford ? 0 : dueCount}
              onStudy={() => setStudying(true)}
              onReview={() => setReviewing(true)}
              insightsTo={isOxford ? undefined : '/my-learning/insights'}
            />

            {!isOxford && <StarterPack />}

            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: 'learn', label: 'To Learn', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: 'completed', label: 'Learned', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <Badge variant="tag" key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.icon}
                  {t.label}
                </Badge>
              ))}
              <Link
                to="/my-learning/tests"
                className="ml-auto inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <ClipboardList className="w-4 h-4" /> Test results
              </Link>
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
                      <WordGroupList
                        groups={groups}
                        onSelect={setSelected}
                        onTest={
                          tab === 'completed'
                            ? (g) => {
                                // Spelling a long idiom is harsh — test single words only.
                                const words = g.words.filter((w) => w.kind !== 'phrase');
                                if (words.length > 0) setTestGroup({ words, label: friendlyDay(g.date) });
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

      <WordDialog
        word={selectedLive}
        onOpenChange={(open) => !open && setSelected(null)}
        onPrev={() => gotoWord(selIdx - 1)}
        onNext={() => gotoWord(selIdx + 1)}
        hasPrev={selIdx > 0}
        hasNext={selIdx >= 0 && selIdx < words.length - 1}
        onComplete={completeAndNext}
        completing={complete.isPending}
      />

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
