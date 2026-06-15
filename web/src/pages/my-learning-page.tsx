import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Play,
  Volume2,
  Check,
  CheckCircle2,
  BookOpen,
  Trophy,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/auth-context';
import {
  useSavedWordsQuery,
  useCompleteSavedWord,
} from '@/hooks/queries/use-saved-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { speak, canSpeak } from '@/utils/speak';
import type { SavedWord } from '@/services/user';

// To "complete" a word the user must spell it correctly in every practice box.
const INPUT_COUNT = 8;
const REQUIRED_CORRECT = INPUT_COUNT;

// ── Date helpers ───────────────────────────────────────────────────────────────
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
function sceneLink(w: SavedWord): string {
  const params = new URLSearchParams();
  if (w.season > 0) params.set('s', String(w.season));
  if (w.episode > 0) params.set('e', String(w.episode));
  if (w.timestamp > 0) params.set('t', String(Math.floor(w.timestamp)));
  const qs = params.toString();
  return `/watch/${w.imdbId}${qs ? `?${qs}` : ''}`;
}

// ── Progress chart ─────────────────────────────────────────────────────────────
// One bar per added-date (most recent ~12 days), height ∝ words added that day,
// with the completed share filled orange and the still-pending share muted.
interface DayStat {
  key: string;
  date: Date;
  total: number;
  completed: number;
}

function ProgressChart({ stats }: { stats: DayStat[] }) {
  const max = Math.max(1, ...stats.map((s) => s.total));
  return (
    <div className="bg-surface border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-end gap-2 sm:gap-3 h-36">
        {stats.map((s) => {
          const totalPct = (s.total / max) * 100;
          const donePct = s.total > 0 ? (s.completed / s.total) * 100 : 0;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-md bg-white/8 overflow-hidden flex flex-col justify-end transition-all"
                  style={{ height: `${Math.max(totalPct, 6)}%` }}
                  title={`${s.completed} completed / ${s.total} added`}
                >
                  <div
                    className="w-full bg-orange-500 transition-all duration-500"
                    style={{ height: `${donePct}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-zinc-500 truncate w-full text-center">
                {s.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-5 mt-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/15" /> Pending
        </span>
      </div>
    </div>
  );
}

// ── Spelling drill ─────────────────────────────────────────────────────────────
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
        {completing ? 'Completing…' : 'Complete word'}
      </Button>
    </div>
  );
}

// ── Word detail dialog ─────────────────────────────────────────────────────────
function WordDialog({
  word,
  onOpenChange,
}: {
  word: SavedWord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const complete = useCompleteSavedWord();
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
              <DialogTitle className="capitalize">{word.word}</DialogTitle>
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

            {/* Dictionary definitions */}
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

// ── Word badge ───────────────────────────────────────────────────────────────
function WordBadge({ word, onClick }: { word: SavedWord; onClick: () => void }) {
  const done = !!word.completedAt;
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-all',
        done
          ? 'border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
          : 'border-white/10 bg-white/5 text-zinc-200 hover:border-white/25 hover:text-white',
      )}
    >
      {done && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />}
      {word.word}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyLearningPage() {
  const { isAuthenticated } = useAuth();
  const { data: words, isLoading } = useSavedWordsQuery();
  const [selected, setSelected] = useState<SavedWord | null>(null);

  const all = useMemo(() => words ?? [], [words]);
  const added = useMemo(() => all.filter((w) => !w.completedAt), [all]);
  const completed = useMemo(() => all.filter((w) => w.completedAt), [all]);

  // Added words grouped by their added day (input order is already newest-first).
  const addedGroups = useMemo(() => {
    const map = new Map<string, { date: Date; words: SavedWord[] }>();
    for (const w of added) {
      const d = parseDate(w.createdAt) ?? new Date(0);
      const key = dayKey(d);
      const entry = map.get(key);
      if (entry) entry.words.push(w);
      else map.set(key, { date: d, words: [w] });
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }));
  }, [added]);

  // Chart: words added per day with their completed share, oldest→newest, last 12.
  const chartStats = useMemo<DayStat[]>(() => {
    const map = new Map<string, DayStat>();
    for (const w of all) {
      const d = parseDate(w.createdAt) ?? new Date(0);
      const key = dayKey(d);
      const entry = map.get(key) ?? { key, date: d, total: 0, completed: 0 };
      entry.total += 1;
      if (w.completedAt) entry.completed += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-12);
  }, [all]);

  // Keep the open dialog's data fresh after completion (it reorders the list).
  const selectedLive = selected
    ? (all.find((w) => w.word === selected.word) ?? selected)
    : null;

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
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Vocabulary</h1>
            <p className="text-sm text-zinc-400">
              {added.length} to learn · {completed.length} completed
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          <div className="bg-surface border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="font-medium text-white">No saved words yet</p>
            <p className="text-sm mt-1">Click a word in the subtitles while watching to save it here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Chart */}
            <ProgressChart stats={chartStats} />

            {/* Added — grouped by date */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                To learn
              </h2>
              {addedGroups.length === 0 ? (
                <div className="bg-surface border border-zinc-800 rounded-2xl p-8 text-center">
                  <Trophy className="w-9 h-9 text-orange-400 mx-auto mb-2" />
                  <p className="text-white font-medium">All caught up!</p>
                  <p className="text-sm text-zinc-500 mt-1">Every saved word has been completed.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {addedGroups.map((g) => (
                    <motion.div
                      key={g.key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className="text-sm font-medium text-zinc-300">{friendlyDay(g.date)}</span>
                        <span className="text-xs text-zinc-600">
                          {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {g.words.map((w) => (
                          <WordBadge key={w.word} word={w} onClick={() => setSelected(w)} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Completed · {completed.length}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {completed.map((w) => (
                    <WordBadge key={w.word} word={w} onClick={() => setSelected(w)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <WordDialog word={selectedLive} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
