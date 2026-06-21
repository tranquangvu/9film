import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, RotateCw, Check, Sparkles, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCompleteWord,
  useWordImage,
  useRegenerateWordImage,
} from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import type { Word } from '@/services/user';

// A playful flip-card study game. The front shows the AI illustration + word;
// flipping reveals the meaning. "Got it" marks the word learned (the new
// complete gate); "Again" requeues it to the back for another pass this session.
export function FlashcardDeck({
  words,
  total,
  hasMore,
  fetchMore,
  onClose,
}: {
  words: Word[];
  total: number;
  hasMore: boolean;
  fetchMore: () => void;
  onClose: () => void;
}) {
  // The queue is a growing list of word keys; current card data is read live from
  // `words` so an illustration that finishes generating appears mid-study.
  const [queue, setQueue] = useState<string[]>(() => words.map((w) => w.word));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [learned, setLearned] = useState(0);
  const complete = useCompleteWord();

  const byKey = useMemo(() => new Map(words.map((w) => [w.word, w])), [words]);

  // Merge newly loaded pages into the study queue as they arrive.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue((prev) => {
      const have = new Set(prev);
      const fresh = words.map((w) => w.word).filter((k) => !have.has(k));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [words]);

  // Pull the next page as we near the end of the loaded queue.
  useEffect(() => {
    if (hasMore && pos >= queue.length - 5) fetchMore();
  }, [hasMore, pos, queue.length, fetchMore]);

  const currentKey = queue[pos];
  const current = currentKey ? byKey.get(currentKey) : undefined;
  const finished = pos >= queue.length && !hasMore;
  const loadingMore = pos >= queue.length && hasMore;

  function gotIt() {
    if (!current) return;
    complete.mutate(current.word);
    setLearned((n) => n + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  function again() {
    if (!currentKey) return;
    setQueue((q) => [...q, currentKey]);
    setFlipped(false);
    setPos((p) => p + 1);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-emerald-950/90 via-black/90 to-black/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={onClose}
        aria-label="Close study"
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-emerald-200/80 mb-1.5">
          <span>{Math.min(learned, total)} / {total} learned</span>
          <span>{finished ? 'Done' : `Card ${pos + 1}`}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-orange-400"
            animate={{ width: `${total ? (learned / total) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {finished ? (
          <DeckDone key="done" learned={learned} onClose={onClose} />
        ) : current ? (
          <Flashcard
            key={currentKey}
            word={current}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onGotIt={gotIt}
            onAgain={again}
            completing={complete.isPending}
          />
        ) : loadingMore ? (
          <p key="loading" className="text-emerald-200/70">Loading more words…</p>
        ) : (
          // Live word vanished (e.g. completed elsewhere) — skip to the next card.
          <SkipCard key={`skip-${pos}`} onSkip={() => setPos((p) => p + 1)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Flashcard({
  word,
  flipped,
  onFlip,
  onGotIt,
  onAgain,
  completing,
}: {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
  onGotIt: () => void;
  onAgain: () => void;
  completing: boolean;
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
      {/* Flip stage */}
      <div style={{ perspective: 1200 }} className="w-full">
        <motion.div
          onClick={onFlip}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-full h-[440px] cursor-pointer select-none"
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface p-5 flex flex-col"
          >
            <CardImage word={word} tint={c.background} />
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
            <p className="mt-auto text-center text-xs text-zinc-500">Tap card to flip</p>
          </div>

          {/* Back */}
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 rounded-3xl border border-white/10 bg-surface p-5 overflow-y-auto"
          >
            <CardBack word={word} />
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" size="md" className="rounded-2xl" onClick={onAgain} disabled={completing}>
          <RotateCw className="w-4 h-4" /> Again
        </Button>
        <Button variant="primary" size="md" className="rounded-2xl" onClick={onGotIt} disabled={completing}>
          <Check className="w-4 h-4" /> Got it
        </Button>
      </div>
    </motion.div>
  );
}

// The illustration area: image when ready, shimmer while generating, or an
// emoji fallback + a "Generate" button (legacy words / failures).
function CardImage({ word, tint }: { word: Word; tint: string }) {
  const url = useWordImage(word.word, word.imageStatus, word.imageUpdatedAt);
  const regen = useRegenerateWordImage();

  // Phrases/idioms get no illustration — show a calm placeholder, not a "generate"
  // prompt (an SVG mnemonic of an idiom is meaningless).
  if (word.kind === 'phrase') {
    return (
      <div className="w-full aspect-square rounded-2xl flex items-center justify-center" style={{ background: tint }}>
        <span className="text-5xl select-none">💬</span>
      </div>
    );
  }

  if (word.imageStatus === 'pending') {
    return <Skeleton className="w-full aspect-square rounded-2xl" />;
  }
  if (word.imageStatus === 'ready' && url) {
    return (
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white">
        <img src={url} alt={word.word} className="w-full h-full object-contain" />
      </div>
    );
  }
  if (word.imageStatus === 'ready') {
    // Ready but the blob is still loading.
    return <Skeleton className="w-full aspect-square rounded-2xl" />;
  }
  // '' (legacy) or 'failed' — offer to generate.
  return (
    <div
      className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 text-center"
      style={{ background: tint }}
    >
      <ImageOff className="w-9 h-9 text-white/50" />
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        disabled={regen.isPending}
        onClick={(e) => { e.stopPropagation(); regen.mutate(word.word); }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {regen.isPending ? 'Starting…' : 'Generate illustration'}
      </Button>
    </div>
  );
}

function CardBack({ word }: { word: Word }) {
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

function DeckDone({ learned, onClose }: { learned: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      className="text-center"
    >
      <div className="text-7xl mb-4 select-none">🎉</div>
      <h2 className="text-2xl font-extrabold text-white">All done!</h2>
      <p className="mt-1 text-emerald-200/80">
        You reviewed {learned} {learned === 1 ? 'word' : 'words'}.
      </p>
      <Button variant="primary" size="md" className="mt-6 rounded-2xl" onClick={onClose}>
        Back to My Learning
      </Button>
    </motion.div>
  );
}

function SkipCard({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="text-center text-zinc-400">
      <p>This word is no longer in your list.</p>
      <Button variant="ghost" size="sm" className="mt-3 rounded-full" onClick={onSkip}>
        Next
      </Button>
    </div>
  );
}
