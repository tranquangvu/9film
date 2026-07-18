import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, HelpCircle, Zap, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDueReviewsQuery, useSubmitReview } from '@/hooks/queries/use-words-query';
import { SectionBreak, SECTION_SIZE } from '@/components/system/learn/section-break';
import { CardField, DeckSkeleton } from '@/components/system/learn/deck-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { useWordTranslation } from '@/hooks/queries/use-translate-query';
import { speak, canSpeak } from '@/utils/speak';
import type { ReviewGrade, Word } from '@/services/user';
import { wordColor, sceneLink } from '@/utils/word';

// Ordered by increasing confidence; `hint` rides along as the button's tooltip.
const GRADES: { id: ReviewGrade; label: string; hint: string; cls: string }[] = [
  { id: 'again', label: 'Again', hint: 'Forgot it — resets and comes back tomorrow', cls: 'bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-900/40 hover:brightness-110' },
  { id: 'hard', label: 'Hard', hint: 'Recalled with effort — comes back a bit sooner', cls: 'bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-900/40 hover:brightness-110' },
  { id: 'good', label: 'Good', hint: 'Recalled fine — next review is pushed further out', cls: 'bg-gradient-to-b from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-900/40 hover:brightness-110' },
  { id: 'easy', label: 'Easy', hint: 'Too easy — waits the longest before returning', cls: 'bg-gradient-to-b from-sky-400 to-indigo-600 text-white shadow-lg shadow-sky-900/40 hover:brightness-110' },
];

// Shared by the card and its loading skeleton so the swap doesn't shift layout.
const CARD_H = 'h-[min(360px,calc(100vh-14rem))]';

// A spaced-repetition review session over the words due today. Front shows the
// word; flip to reveal the meaning, then rate recall (Again/Hard/Good/Easy)
// which reschedules the word via SM-2. The due list is snapshotted once so
// optimistic removals don't reshuffle the session mid-way.
export function ReviewDeck({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useDueReviewsQuery();
  const review = useSubmitReview();
  const [queue, setQueue] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  // Section pacing: pause on a break screen after every SECTION_SIZE graded cards,
  // once the due set is bigger than a single section.
  const [paused, setPaused] = useState(false);
  const [sectionDone, setSectionDone] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(1);

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
  const sectioned = total > SECTION_SIZE;

  function grade(g: ReviewGrade) {
    if (!current) return;
    review.mutate({ word: current.word, grade: g });
    setReviewed((n) => n + 1);
    setFlipped(false);
    // Pause between sections, but never on the last card (that ends on ReviewDone).
    const doneInSection = sectionDone + 1;
    const wasLast = pos >= total - 1;
    setPos((p) => p + 1);
    if (sectioned && !wasLast && doneInSection >= SECTION_SIZE) {
      setPaused(true);
    } else {
      setSectionDone(doneInSection);
    }
  }

  function continueSection() {
    setSectionDone(0);
    setSectionIndex((i) => i + 1);
    setPaused(false);
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

      <div className="w-full max-w-md mb-6">
        <div className="flex h-4 items-center justify-between text-xs font-medium text-sky-200/80 mb-1.5">
          {isLoading ? <Skeleton className="h-3 w-24 rounded-full" /> : <span>{reviewed} reviewed</span>}
          {isLoading ? (
            <Skeleton className="h-3 w-16 rounded-full" />
          ) : (
            <span>
              {finished || empty
                ? 'Done'
                : paused
                  ? 'Break'
                  : sectioned
                    ? `Section ${sectionIndex} · ${sectionDone}/${SECTION_SIZE}`
                    : `${Math.min(pos + 1, total)} / ${total} due`}
            </span>
          )}
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
          <DeckSkeleton key="loading" height={CARD_H} actions={1} wordSize="text-6xl" />
        ) : paused ? (
          <SectionBreak
            key={`break-${sectionIndex}`}
            sectionIndex={sectionIndex}
            doneCount={SECTION_SIZE}
            onContinue={continueSection}
            onClose={onClose}
          />
        ) : empty || finished ? (
          <ReviewDone key="done" reviewed={reviewed} onClose={onClose} />
        ) : current ? (
          <ReviewCard
            key={currentKey}
            word={current}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
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

      {/* Pinned to the bottom so it never shifts the centred card when it appears. */}
      {current && flipped && !paused && !finished && !empty && (
        <p className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-1.5 px-4 text-center text-xs text-zinc-500">
          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
          How well did you recall it? Your rating sets when this word comes back.
        </p>
      )}
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
  // Same cached lookup the back uses (identical query key), so the front's
  // phonetic costs no extra request. Only the meaning is withheld until flip.
  const dict = useDictionaryQuery(word.word);
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="w-full max-w-md"
    >
      <div style={{ perspective: 1200 }} className="w-full">
        <motion.div
          onClick={onFlip}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{ transformStyle: 'preserve-3d' }}
          className={`relative w-full cursor-pointer select-none ${CARD_H}`}
        >
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-3xl border border-white/10 bg-surface p-5"
          >
            <p className="relative">
              <span
                className="text-center text-6xl font-extrabold capitalize leading-tight tracking-tight break-words"
                style={{ color: c }}
              >
                {word.word}
              </span>
              {canSpeak() && (
                <button
                  onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                  aria-label="Pronounce"
                  style={{ color: c }}
                  className="absolute top-2 -right-11 shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              )}
            </p>
            {/* Phonetic only — the meaning is what the review asks you to recall. */}
            <CardField
              value={dict.data?.phonetic}
              loading={dict.isLoading}
              className="text-sm tracking-wide text-zinc-500"
              skeletonWidth="w-20"
            />
            <p className="absolute inset-x-0 bottom-5 text-center text-xs text-zinc-500">
              Recall the meaning, then tap to check
            </p>
          </div>

          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface p-5 overflow-y-auto"
          >
            <ReviewBack word={word} />
          </div>
        </motion.div>
      </div>

      <div className="mt-5">
        {!flipped ? (
          <Button
            variant="primary"
            size="md"
            className="w-full rounded-2xl text-zinc-950 shadow-none"
            style={{ backgroundColor: c }}
            onClick={onFlip}
          >
            <Zap className="w-4 h-4" /> Show answer
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <motion.button
                key={g.id}
                whileTap={{ scale: 0.94 }}
                disabled={grading}
                onClick={() => onGrade(g.id)}
                title={g.hint}
                className={`rounded-2xl px-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${g.cls}`}
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

function ReviewBack({ word }: { word: Word }) {
  const dict = useDictionaryQuery(word.word);
  const translation = useWordTranslation(word);
  const color = wordColor(word.word);
  // Tapping the back flips it to the front, same as the study deck; only the
  // interactive controls below stop the click from reaching the flip handler.
  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold capitalize" style={{ color }}>{word.word}</h3>
        <CardField
          value={dict.data?.phonetic}
          loading={dict.isLoading}
          className="text-sm text-zinc-500"
          skeletonWidth="w-20"
        />
      </div>
      <CardField
        value={translation.text}
        loading={translation.isLoading}
        className="mt-1 font-semibold"
        skeletonWidth="w-28"
        style={{ color }}
      />
      {word.sentence && (
        <div className="mt-2 flex items-start gap-2">
          <p className="italic text-sm text-zinc-400">“{word.sentence}”</p>
          {canSpeak() && (
            <button
              onClick={(e) => { e.stopPropagation(); speak(word.sentence); }}
              aria-label="Read sentence"
              style={{ color }}
              className="shrink-0 mt-0.5 opacity-90 hover:opacity-100"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {/* Imported starter-pack words carry no imdbId — no scene to go back to.
          stopPropagation so following the link doesn't also flip the card. */}
      {word.imdbId && (
        <Link
          to={sceneLink(word)}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          style={{ color }}
          className="mt-2 inline-flex items-center gap-1.5 text-xs opacity-90 hover:opacity-100"
        >
          <Play className="w-3.5 h-3.5" /> Watch the scene
        </Link>
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
