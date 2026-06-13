import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Play, Trash2, RotateCcw, Check, BookOpen } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import {
  useSavedWordsQuery,
  useRemoveSavedWord,
  useReviewSavedWord,
} from '@/hooks/queries/use-saved-words-query';
import type { SavedWord } from '@/services/user';

// Leitner intervals (days until next review) indexed by box. Box 0 is due today.
const INTERVALS = [0, 1, 3, 7, 16, 35];
const MAX_BOX = INTERVALS.length - 1;

function isDue(w: SavedWord): boolean {
  if (!w.dueAt) return true;
  // SQLite datetime is UTC "YYYY-MM-DD HH:MM:SS"; compare as timestamps.
  const due = new Date(w.dueAt.replace(' ', 'T') + 'Z').getTime();
  return Number.isNaN(due) || due <= Date.now();
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

// ── Flashcard review ──────────────────────────────────────────────────────────
function ReviewDeck({ due }: { due: SavedWord[] }) {
  const review = useReviewSavedWord();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const card = due[idx];

  const grade = (good: boolean) => {
    if (!card) return;
    const box = good ? Math.min(card.box + 1, MAX_BOX) : 0;
    review.mutate({ word: card.word, box, intervalDays: INTERVALS[box] });
    setRevealed(false);
    setDone((d) => d + 1);
    setIdx((i) => i + 1);
  };

  if (!card) {
    return (
      <div className="bg-surface border border-zinc-800 rounded-2xl p-10 text-center">
        <Check className="w-10 h-10 text-orange-400 mx-auto mb-3" />
        <p className="text-white font-semibold">All caught up!</p>
        <p className="text-sm text-zinc-500 mt-1">
          {done > 0 ? `Reviewed ${done} ${done === 1 ? 'word' : 'words'}.` : 'No words due for review right now.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-zinc-500">{idx + 1} / {due.length} due</span>
        <span className="text-xs text-zinc-500">Box {card.box}</span>
      </div>

      <motion.div
        key={card.word}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[180px] flex flex-col items-center justify-center text-center gap-3 py-6"
      >
        <h2 className="text-3xl font-bold text-white capitalize">{card.word}</h2>

        {revealed ? (
          <div className="space-y-2">
            {card.translation && <p className="text-orange-300 text-lg font-medium">{card.translation}</p>}
            {card.sentence && <p className="text-sm text-zinc-400 italic max-w-md">“{card.sentence}”</p>}
            <Link to={sceneLink(card)} className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300">
              <Play className="w-3.5 h-3.5" /> Watch the scene
            </Link>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Recall the meaning, then reveal.</p>
        )}
      </motion.div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => grade(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Again
          </button>
          <button
            onClick={() => grade(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            <Check className="w-4 h-4" /> Good
          </button>
        </div>
      ) : (
        <Button variant="primary" className="w-full rounded-xl" onClick={() => setRevealed(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}

// ── Saved-words list ──────────────────────────────────────────────────────────
function WordList({ words }: { words: SavedWord[] }) {
  const remove = useRemoveSavedWord();
  return (
    <div className="bg-surface border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
      {words.map((w) => (
        <div key={w.word} className="flex items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold capitalize">{w.word}</span>
              {w.translation && <span className="text-sm text-orange-300/80 truncate">{w.translation}</span>}
            </div>
            {w.sentence && <p className="text-xs text-zinc-500 italic truncate mt-0.5">“{w.sentence}”</p>}
          </div>
          {w.imdbId && (
            <Link
              to={sceneLink(w)}
              aria-label="Watch the scene"
              className="shrink-0 text-zinc-500 hover:text-orange-400 p-2"
            >
              <Play className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={() => remove.mutate(w.word)}
            aria-label="Remove word"
            className="shrink-0 text-zinc-500 hover:text-red-400 p-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyLearningPage() {
  const { isAuthenticated } = useAuth();
  const { data: words, isLoading } = useSavedWordsQuery();
  const [tab, setTab] = useState<'review' | 'all'>('review');

  const due = useMemo(() => (words ?? []).filter(isDue), [words]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 text-center text-zinc-400">
        <p>Please <Link to="/login" className="text-orange-400">sign in</Link> to use your vocabulary.</p>
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
              {(words?.length ?? 0)} saved · {due.length} due for review
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {([
            { id: 'review', label: 'Review', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'all', label: 'All words', icon: <BookOpen className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                tab === t.id
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                  : 'text-zinc-400 hover:text-white border border-transparent',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : (words?.length ?? 0) === 0 ? (
          <div className="bg-surface border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="font-medium text-white">No saved words yet</p>
            <p className="text-sm mt-1">Click a word in the subtitles while watching to save it here.</p>
          </div>
        ) : tab === 'review' ? (
          <ReviewDeck due={due} />
        ) : (
          <WordList words={words ?? []} />
        )}
      </div>
    </div>
  );
}
