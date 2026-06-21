import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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
} from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import { LoadMoreIndicator } from '@/components/system/common/load-more-indicator';
import { FlashcardDeck } from '@/components/system/learn/flashcard-deck';
import type { Word, WordStat } from '@/services/user';

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

const TO_LEARN_COLOR = '#34d399'; // emerald-400
const COMPLETED_COLOR = '#fb923c'; // orange-400

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
  const yAt = (v: number) => 95 - (v / max) * 90;
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
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
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
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
          <polyline points={points(added)} fill="none" stroke={TO_LEARN_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <polyline points={points(completed)} fill="none" stroke={COMPLETED_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {added.map((v, i) => (
          <Fragment key={i}>
            {v > 0 && (
              <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${xAt(i)}%`, top: `${yAt(v)}%`, background: TO_LEARN_COLOR }} />
            )}
            {completed[i] > 0 && (
              <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${xAt(i)}%`, top: `${yAt(completed[i])}%`, background: COMPLETED_COLOR }} />
            )}
          </Fragment>
        ))}
      </div>

      <div className="relative mt-1 h-4">
        {added.map((_, i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-500" style={{ left: `${xAt(i)}%` }}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TO_LEARN_COLOR }} /> Added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPLETED_COLOR }} /> Completed
        </span>
      </div>
    </div>
  );
}

// Playful header: a bouncing mascot, the title, and bubbly stat pills.
function LearningHero({
  addedCount,
  completedCount,
  streak,
  onStudy,
}: {
  addedCount: number;
  completedCount: number;
  streak: number;
  onStudy: () => void;
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
          🐰
        </motion.div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Vocabulary Garden</h1>
          <p className="text-sm text-emerald-100/70">Grow your words — one flashcard at a time.</p>
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
      </div>

      {addedCount > 0 && (
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-5 inline-block">
          <Button variant="primary" size="lg" className="rounded-2xl" onClick={onStudy}>
            <GraduationCap className="w-5 h-5" /> Study {addedCount} {addedCount === 1 ? 'word' : 'words'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

function WordDialog({ word, onOpenChange }: { word: Word | null; onOpenChange: (open: boolean) => void }) {
  const dict = useDictionaryQuery(word?.word);
  const imageUrl = useWordImage(word?.word ?? '', word?.imageStatus, word?.imageUpdatedAt);

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

            {dict.isLoading && <p className="mt-4 text-sm text-zinc-600">Loading definitions…</p>}
            {dict.data && (
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
              <p className="mt-6 text-center text-xs text-zinc-500">
                Tap <span className="text-emerald-300 font-medium">Study</span> to review this word and mark it learned.
              </p>
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

function WordGroupList({ groups, onSelect }: { groups: DayGroup[]; onSelect: (w: Word) => void }) {
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
      {word.imageStatus === 'ready' && <span className="mr-1">🖼️</span>}
      {word.word}
    </Badge>
  );
}

export default function MyLearningPage() {
  const { isAuthenticated } = useAuth();
  const stats = useWordStatsQuery();
  const [selected, setSelected] = useState<Word | null>(null);
  const [tab, setTab] = useState<'learn' | 'completed'>('learn');
  const [studying, setStudying] = useState(false);

  const all = useMemo(() => stats.data ?? [], [stats.data]);
  const addedCount = useMemo(() => all.filter((w) => !w.completedAt).length, [all]);
  const completedCount = useMemo(() => all.filter((w) => w.completedAt).length, [all]);
  const streak = useMemo(() => computeStreak(all), [all]);

  // The active tab's words (rendered list). The "learn" set also feeds the deck;
  // when tab is "learn" this is the same cached query, so no double fetch.
  const list = useInfiniteWordsQuery(tab);
  const words = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const groups = useMemo(
    () => groupByDay(words, (w) => (tab === 'learn' ? w.createdAt : w.completedAt)),
    [words, tab],
  );

  // Words the flashcard deck studies — always the "to learn" set.
  const learnList = useInfiniteWordsQuery('learn');
  const learnWords = useMemo(() => learnList.data?.pages.flatMap((p) => p.items) ?? [], [learnList.data]);

  const selectedLive = selected ? (words.find((w) => w.word === selected.word) ?? selected) : null;

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
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-950/40 via-background to-background pt-24 pb-16 px-4 md:px-8 lg:px-12"
      style={{
        backgroundImage:
          'linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="mx-auto max-w-3xl">
        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-transparent p-10 text-center">
            <div className="text-6xl mb-3 select-none">🌱</div>
            <p className="font-bold text-white text-lg">Your garden is empty</p>
            <p className="text-sm text-emerald-100/60 mt-1">Click a word in the subtitles while watching to plant it here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <LearningHero
              addedCount={addedCount}
              completedCount={completedCount}
              streak={streak}
              onStudy={() => setStudying(true)}
            />

            <ProgressChart words={all} />

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
                {groups.length > 0 && <WordGroupList groups={groups} onSelect={setSelected} />}
                {(list.isLoading || isFetchingNextPage) && <LoadMoreIndicator className="mt-2" />}
                <div ref={sentinelRef} className="h-1" />
              </>
            )}
          </div>
        )}
      </div>

      <WordDialog word={selectedLive} onOpenChange={(open) => !open && setSelected(null)} />

      <AnimatePresence>
        {studying && <FlashcardDeck words={learnWords} onClose={() => setStudying(false)} />}
      </AnimatePresence>
    </div>
  );
}
