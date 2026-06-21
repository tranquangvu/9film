import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play,
  Volume2,
  Check,
  CheckCircle2,
  BookOpen,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  useCompleteWord,
} from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import { LoadMoreIndicator } from '@/components/system/common/load-more-indicator';
import type { Word, WordStat } from '@/services/user';

// To "complete" a word the user must spell it correctly in every practice box.
const INPUT_COUNT = 8;
const REQUIRED_CORRECT = INPUT_COUNT;

// SQLite stamps are UTC "YYYY-MM-DD HH:MM:SS"; optimistic stamps are ISO. Parse
// both, then bucket by the viewer's local calendar day.
function parseDate(s?: string): Date | null {
  if (!s) return null;
  const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// Two lines across every day of the selected month: words added that day
// ("to learn", blue) and words completed that day ("completed", green).
const TO_LEARN_COLOR = '#3b82f6'; // blue-500
const COMPLETED_COLOR = '#22c55e'; // green-500

function ProgressChart({ words }: { words: WordStat[] }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const { added, completed, daysInMonth } = useMemo(() => {
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const a = new Array(days).fill(0);
    const c = new Array(days).fill(0);
    for (const w of words) {
      const cr = parseDate(w.createdAt);
      if (cr && cr.getFullYear() === view.year && cr.getMonth() === view.month) a[cr.getDate() - 1]++;
      const cp = parseDate(w.completedAt);
      if (cp && cp.getFullYear() === view.year && cp.getMonth() === view.month) c[cp.getDate() - 1]++;
    }
    return { added: a, completed: c, daysInMonth: days };
  }, [words, view]);

  const max = Math.max(1, ...added, ...completed);
  const xAt = (i: number) => (daysInMonth <= 1 ? 50 : (i / (daysInMonth - 1)) * 100);
  const yAt = (v: number) => 95 - (v / max) * 90; // 0 = top; padded 5% top/bottom
  const points = (series: number[]) => series.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className="bg-surface border border-zinc-800 rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white">{monthLabel}</span>
        <button
          onClick={() => step(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="relative h-28">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Per-day vertical grid lines */}
          {added.map((_, i) => (
            <line
              key={i}
              x1={xAt(i)}
              y1={0}
              x2={xAt(i)}
              y2={100}
              stroke="#ffffff"
              strokeOpacity={0.06}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={points(added)}
            fill="none"
            stroke={TO_LEARN_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={points(completed)}
            fill="none"
            stroke={COMPLETED_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Dots on days that have activity (kept circular outside the SVG). */}
        {added.map((v, i) => (
          <Fragment key={i}>
            {v > 0 && (
              <span
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${xAt(i)}%`, top: `${yAt(v)}%`, background: TO_LEARN_COLOR }}
              />
            )}
            {completed[i] > 0 && (
              <span
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${xAt(i)}%`, top: `${yAt(completed[i])}%`, background: COMPLETED_COLOR }}
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* X-axis day labels (every day of the month). */}
      <div className="relative mt-1 h-4">
        {added.map((_, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-500"
            style={{ left: `${xAt(i)}%` }}
          >
            {i + 1}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TO_LEARN_COLOR }} /> To learn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPLETED_COLOR }} /> Completed
        </span>
      </div>
    </div>
  );
}

function SpellingDrill({
  word,
  onComplete,
  completing,
}: {
  word: string;
  onComplete: () => void;
  completing: boolean;
}) {
  const [values, setValues] = useState<string[]>(() => Array(INPUT_COUNT).fill(''));
  const target = word.trim().toLowerCase();

  const correct = values.map((v) => v.trim().toLowerCase() === target && target.length > 0);
  const correctCount = correct.filter(Boolean).length;
  const ready = correctCount >= REQUIRED_CORRECT;

  return (
    <div className="mt-6 border-t border-zinc-800 pt-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Practice to complete</h3>
        <span className={cn('text-xs font-medium', ready ? 'text-orange-400' : 'text-zinc-500')}>
          {Math.min(correctCount, REQUIRED_CORRECT)} / {REQUIRED_CORRECT} correct
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        Type the word correctly in all {INPUT_COUNT} boxes, then complete it.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {values.map((v, i) => (
          <div key={i} className="relative">
            <input
              value={v}
              onChange={(e) => {
                const next = e.target.value;
                setValues((prev) => prev.map((p, j) => (j === i ? next : p)));
                // Reinforce pronunciation the moment a box becomes correct.
                if (next.trim().toLowerCase() === target && target.length > 0) {
                  speak(word);
                }
              }}
              placeholder={`#${i + 1}`}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                'w-full rounded-lg border bg-white/5 px-3 py-2 pr-7 text-sm text-white outline-none transition-colors placeholder:text-zinc-600',
                correct[i]
                  ? 'border-orange-500/60 bg-orange-500/10'
                  : v
                    ? 'border-red-500/40'
                    : 'border-white/10 focus:border-white/30',
              )}
            />
            {correct[i] && (
              <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
            )}
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        className="w-full rounded-xl mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!ready || completing}
        onClick={onComplete}
      >
        <CheckCircle2 className="w-4 h-4" />
        {completing ? 'Completing…' : 'Complete'}
      </Button>
    </div>
  );
}

function WordDialog({
  word,
  onOpenChange,
}: {
  word: Word | null;
  onOpenChange: (open: boolean) => void;
}) {
  const complete = useCompleteWord();
  const dict = useDictionaryQuery(word?.word);

  // Pronounce automatically when a new word is opened (keyed on the word string
  // so a background refetch re-creating the object doesn't re-trigger speech).
  const openWord = word?.word;
  useEffect(() => {
    if (openWord) speak(openWord);
  }, [openWord]);

  const isDone = !!word?.completedAt;

  return (
    <Dialog open={!!word} onOpenChange={onOpenChange}>
      <DialogContent>
        {word && (
          <div>
            <div className="flex items-center gap-3 pr-8">
              <DialogTitle className="capitalize" style={{ color: wordColor(word.word).color }}>
                {word.word}
              </DialogTitle>
              {canSpeak() && (
                <button
                  onClick={() => speak(word.word)}
                  aria-label="Pronounce word"
                  className="shrink-0 text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}
              {isDone && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-orange-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
              )}
            </div>

            {dict.data?.phonetic && (
              <p className="mt-1 text-sm text-zinc-500">{dict.data.phonetic}</p>
            )}

            {word.translation && (
              <p className="mt-2 text-orange-300 font-medium">{word.translation}</p>
            )}
            {word.sentence && (
              <div className="mt-2 flex items-start gap-2">
                <DialogDescription className="italic text-zinc-400">
                  “{word.sentence}”
                </DialogDescription>
                {canSpeak() && (
                  <button
                    onClick={() => speak(word.sentence)}
                    aria-label="Read sentence aloud"
                    className="shrink-0 mt-1 text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {word.imdbId && (
              <Link
                to={sceneLink(word)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300"
                target="_blank"
              >
                <Play className="w-3.5 h-3.5" /> Watch the scene
              </Link>
            )}

            {dict.isLoading && (
              <p className="mt-4 text-sm text-zinc-600">Loading definitions…</p>
            )}
            {dict.data && (
              <div className="mt-4 space-y-3">
                {dict.data.meanings.slice(0, 4).map((m, i) => (
                  <div key={`${m.partOfSpeech}-${i}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {m.partOfSpeech}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {m.definitions.slice(0, 3).map((d, j) => (
                        <li key={j} className="text-sm text-zinc-200">
                          <span className="text-zinc-500 mr-1.5">•</span>
                          {d.definition}
                          {d.example && (
                            <span className="block pl-4 mt-0.5 text-zinc-500 italic">
                              “{d.example}”
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {!isDone && (
              <SpellingDrill
                key={word.word}
                word={word.word}
                completing={complete.isPending}
                onComplete={() =>
                  complete.mutate(word.word, { onSuccess: () => onOpenChange(false) })
                }
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DayGroup {
  key: string;
  date: Date;
  words: Word[];
}

// Bucket words by the local calendar day of `dateOf`, newest day first and
// newest word first within each day. Used for both the added and completed
// lists so they share an identical day-grouped layout.
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

// Day-grouped chips, shared by the To Learn and Completed tabs.
function WordGroupList({
  groups,
  onSelect,
}: {
  groups: DayGroup[];
  onSelect: (w: Word) => void;
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
// text) so the "To Learn" and "Completed" lists read as soft, colorful chips.
function WordBadge({ word, onClick }: { word: Word; onClick: () => void }) {
  const c = wordColor(word.word);
  return (
    <Badge variant="tag"
      onClick={onClick}
      style={{ background: c.background, borderColor: c.borderColor, color: c.color }}
      className="capitalize cursor-pointer hover:brightness-125"
    >
      {word.word}
    </Badge>
  );
}

export default function MyLearningPage() {
  const { isAuthenticated } = useAuth();
  // Lightweight full vocabulary powers the chart and the header counts; the
  // visible per-tab lists are paginated separately and infinite-scroll.
  const stats = useWordStatsQuery();
  const [selected, setSelected] = useState<Word | null>(null);
  const [tab, setTab] = useState<'learn' | 'completed'>('learn');

  const all = useMemo(() => stats.data ?? [], [stats.data]);
  const addedCount = useMemo(() => all.filter((w) => !w.completedAt).length, [all]);
  const completedCount = useMemo(() => all.filter((w) => w.completedAt).length, [all]);

  // The active tab's saved words, flattened across loaded pages and grouped by
  // day (added day for "to learn", completed day for "completed").
  const list = useInfiniteWordsQuery(tab);
  const words = useMemo(
    () => list.data?.pages.flatMap((p) => p.items) ?? [],
    [list.data],
  );
  const groups = useMemo(
    () => groupByDay(words, (w) => (tab === 'learn' ? w.createdAt : w.completedAt)),
    [words, tab],
  );

  // Keep the open dialog's data fresh from whatever page it lives on.
  const selectedLive = selected
    ? (words.find((w) => w.word === selected.word) ?? selected)
    : null;

  // Infinite scroll: pull the next page when the sentinel nears the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
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
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">My Learning</h1>
          <p className="text-sm text-zinc-400">
            {addedCount} to learn · {completedCount} completed
          </p>
        </div>

        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          <div className="bg-surface border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="font-medium text-white">No saved words yet</p>
            <p className="text-sm mt-1">Click a word in the subtitles while watching to save it here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <ProgressChart words={all} />

            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: 'learn', label: 'To Learn', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <Badge variant="tag" key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.icon}
                  {t.label}
                </Badge>
              ))}
            </div>

            {tab === 'learn' && addedCount === 0 ? (
              <div className="bg-surface border border-zinc-800 rounded-2xl p-8 text-center">
                <Trophy className="w-9 h-9 text-orange-400 mx-auto mb-2" />
                <p className="text-white font-medium">All caught up!</p>
                <p className="text-sm text-zinc-500 mt-1">Every saved word has been completed.</p>
              </div>
            ) : tab === 'completed' && completedCount === 0 ? (
              <div className="bg-surface border border-zinc-800 rounded-2xl p-8 text-center">
                <BookOpen className="w-9 h-9 text-zinc-600 mx-auto mb-2" />
                <p className="text-white font-medium">Nothing completed yet</p>
                <p className="text-sm text-zinc-500 mt-1">Finish a word's practice to move it here.</p>
              </div>
            ) : (
              <>
                {groups.length > 0 && <WordGroupList groups={groups} onSelect={setSelected} />}
                {(list.isLoading || isFetchingNextPage) && <LoadMoreIndicator className="mt-2" />}
                <div ref={sentinelRef} className="h-1" />
              </>
            )}
          </div>
        )}
      </div>

      <WordDialog word={selectedLive} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
