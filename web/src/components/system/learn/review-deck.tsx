import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDueReviewsQuery, useSubmitReview, useWordImage } from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import type { ReviewGrade, Word } from '@/services/user';

// The four SM-2 recall ratings, in increasing confidence. Colors hint difficulty.
const GRADES: { id: ReviewGrade; label: string; cls: string }[] = [
  { id: 'again', label: 'Again', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/30 hover:bg-rose-500/30' },
  { id: 'hard', label: 'Hard', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30 hover:bg-amber-500/30' },
  { id: 'good', label: 'Good', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/30' },
  { id: 'easy', label: 'Easy', cls: 'bg-sky-500/20 text-sky-200 border-sky-400/30 hover:bg-sky-500/30' },
];

// A spaced-repetition review session over the words due today. Front shows the
// illustration + word; flip to reveal the meaning, then rate recall (Again/Hard/
// Good/Easy) which reschedules the word via SM-2. The due list is snapshotted once
// so optimistic removals don't reshuffle the session mid-way.
export function ReviewDeck({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useDueReviewsQuery();
  const review = useSubmitReview();
  const [queue, setQueue] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  // Snapshot the due set once, the first time it loads.
  useEffect(() => {
    if (queue.length === 0 && data && data.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue(data.map((w) => w.word));
    }
  }, [data, queue.length]);

  const byKey = useMemo(() => new Map((data ?? []).map((w) => [w.word, w])), [data]);
  const total = queue.length;
  const currentKey = queue[pos];
  const current = currentKey ? byKey.get(currentKey) : undefined;
  const finished = total > 0 && pos >= total;
  const empty = !isLoading && total === 0 && (data?.length ?? 0) === 0;

  function grade(g: ReviewGrade) {
    if (!current) return;
    review.mutate({ word: current.word, grade: g });
    setReviewed((n) => n + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-sky-950/90 via-black/90 to-black/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={onClose}
        aria-label="Close review"
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-sky-200/80 mb-1.5">
          <span>{reviewed} reviewed</span>
          <span>{finished || empty ? 'Done' : `${Math.min(pos + 1, total)} / ${total} due`}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
            animate={{ width: `${total ? (Math.min(pos, total) / total) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <p key="loading" className="text-sky-200/70">Loading reviews…</p>
        ) : empty || finished ? (
          <ReviewDone key="done" reviewed={reviewed} onClose={onClose} />
        ) : current ? (
          <ReviewCard
            key={currentKey}
            word={current}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onGrade={grade}
            grading={review.isPending}
          />
        ) : (
          // The live word vanished (e.g. graded already) — advance.
          <button key={`skip-${pos}`} className="text-zinc-400 hover:text-white" onClick={() => setPos((p) => p + 1)}>
            Next →
          </button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReviewCard({
  word,
  flipped,
  onFlip,
  onGrade,
  grading,
}: {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
  onGrade: (g: ReviewGrade) => void;
  grading: boolean;
}) {
  const c = wordColor(word.word);
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="w-full max-w-sm"
    >
      <div style={{ perspective: 1200 }} className="w-full">
        <motion.div
          onClick={onFlip}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-full h-[420px] cursor-pointer select-none"
        >
          {/* Front: illustration + word */}
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface p-5 flex flex-col"
          >
            <ReviewImage word={word} tint={c.background} />
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-2xl font-extrabold capitalize tracking-tight" style={{ color: c.color }}>
                {word.word}
              </span>
              {canSpeak() && (
                <button
                  onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                  aria-label="Pronounce"
                  className="text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="mt-auto text-center text-xs text-zinc-500">Recall the meaning, then tap to check</p>
          </div>

          {/* Back: meaning */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface p-5 overflow-y-auto"
          >
            <ReviewBack word={word} />
          </div>
        </motion.div>
      </div>

      {/* Controls: flip first, then grade recall */}
      <div className="mt-5">
        {!flipped ? (
          <Button variant="outline" size="md" className="w-full rounded-2xl" onClick={onFlip}>
            Show answer
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <motion.button
                key={g.id}
                whileTap={{ scale: 0.94 }}
                disabled={grading}
                onClick={() => onGrade(g.id)}
                className={`rounded-2xl border px-2 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${g.cls}`}
              >
                {g.label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Front illustration: image when ready, shimmer while generating, emoji-tint
// fallback otherwise (no "generate" CTA here — reviews aren't the place for it).
function ReviewImage({ word, tint }: { word: Word; tint: string }) {
  const url = useWordImage(word.word, word.imageStatus, word.imageUpdatedAt);
  if (word.imageStatus === 'ready' && url) {
    return (
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white">
        <img src={url} alt={word.word} className="w-full h-full object-contain" />
      </div>
    );
  }
  if (word.imageStatus === 'pending' || word.imageStatus === 'ready') {
    return <Skeleton className="w-full aspect-square rounded-2xl" />;
  }
  return (
    <div className="w-full aspect-square rounded-2xl flex items-center justify-center" style={{ background: tint }}>
      <Sparkles className="w-9 h-9 text-white/40" />
    </div>
  );
}

function ReviewBack({ word }: { word: Word }) {
  const dict = useDictionaryQuery(word.word);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold capitalize text-white">{word.word}</h3>
        {dict.data?.phonetic && <span className="text-sm text-zinc-500">{dict.data.phonetic}</span>}
      </div>
      {word.translation && <p className="mt-1 text-orange-300 font-semibold">{word.translation}</p>}
      {word.sentence && (
        <div className="mt-2 flex items-start gap-2">
          <p className="italic text-sm text-zinc-400">“{word.sentence}”</p>
          {canSpeak() && (
            <button
              onClick={() => speak(word.sentence)}
              aria-label="Read sentence"
              className="shrink-0 mt-0.5 text-orange-400 hover:text-orange-300"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {dict.data && (
        <div className="mt-3 space-y-2.5">
          {dict.data.meanings.slice(0, 3).map((m, i) => (
            <div key={`${m.partOfSpeech}-${i}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{m.partOfSpeech}</p>
              <ul className="mt-1 space-y-1">
                {m.definitions.slice(0, 2).map((d, j) => (
                  <li key={j} className="text-sm text-zinc-200">
                    <span className="text-zinc-500 mr-1.5">•</span>{d.definition}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewDone({ reviewed, onClose }: { reviewed: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      className="text-center"
    >
      <div className="text-7xl mb-4 select-none">{reviewed > 0 ? '🧠' : '✅'}</div>
      <h2 className="text-2xl font-extrabold text-white">
        {reviewed > 0 ? 'Review complete!' : 'Nothing due'}
      </h2>
      <p className="mt-1 text-sky-200/80">
        {reviewed > 0
          ? `You reviewed ${reviewed} ${reviewed === 1 ? 'word' : 'words'}. See you next time.`
          : 'No words are due for review right now — check back later.'}
      </p>
      <Button variant="primary" size="md" className="mt-6 rounded-2xl" onClick={onClose}>
        Back to My Learning
      </Button>
    </motion.div>
  );
}
