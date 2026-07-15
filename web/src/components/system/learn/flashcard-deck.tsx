import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, RotateCw, Check, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompleteWord } from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { useWordTranslation } from '@/hooks/queries/use-translate-query';
import { SpellBoxes } from '@/components/system/learn/spell-boxes';
import { speak, canSpeak } from '@/utils/speak';
import type { Word } from '@/services/user';
import { isSpelled, spelledCount, sceneLink } from '@/utils/word';

const SPELL_TIMES = 6; // times the word must be retyped before "Got it" unlocks

// A playful flip-card study game. The front shows the word; flipping reveals the
// meaning and the retype boxes. "Got it" marks the word learned once they all
// match; "Again" requeues it to the back for another pass this session.
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
  // `words` so a word edited mid-study shows its latest state.
  const [queue, setQueue] = useState<string[]>(() => words.map((w) => w.word));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [learned, setLearned] = useState(0);
  const complete = useCompleteWord();

  const byKey = useMemo(() => new Map(words.map((w) => [w.word, w])), [words]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue((prev) => {
      const have = new Set(prev);
      const fresh = words.map((w) => w.word).filter((k) => !have.has(k));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [words]);

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

      <div className="w-full max-w-md mb-6">
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
  const translation = useWordTranslation(word);
  // Shares the back's cached lookup (same query key), so this costs no request.
  const phonetic = useDictionaryQuery(word.word).data?.phonetic;
  // Same retype gate as the word dialog: "Got it" unlocks once every box matches.
  // The parent keys this component by word, so the boxes clear on each new card.
  const [spellings, setSpellings] = useState<string[]>(() => Array(SPELL_TIMES).fill(''));
  const done = spelledCount(word.word, spellings);
  const spelled = isSpelled(word.word, spellings);
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
          className="relative w-full h-[min(320px,calc(100vh-14rem))] cursor-pointer select-none"
        >
          <div
            style={{ backfaceVisibility: 'hidden' }}
            className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5"
          >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
              <p className="relative">
                <span
                  className="text-center text-5xl font-bold capitalize leading-tight tracking-tight text-white break-words"
                >
                  {word.word}
                </span>
                {canSpeak() && (
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                    aria-label="Pronounce"
                    className="absolute top-2 -right-9 shrink-0 rounded-full p-1.5 text-orange-400 transition-colors hover:bg-white/5 hover:text-orange-300"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </p>
              {phonetic && (
                <p className="text-sm tracking-wide text-zinc-500">{phonetic}</p>
              )}
              {translation && (
                <p className="text-center text-base font-semibold text-orange-300">{translation}</p>
              )}
            </div>
            <div className="mt-3 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-baseline justify-center gap-1">
                <p className="text-xs tracking-wide text-zinc-500">
                  Type it till it sticks
                </p>
                <span
                  className={`text-xs tabular-nums transition-colors ${spelled ? 'text-emerald-400' : 'text-zinc-400'}`}
                >
                  {done}/{SPELL_TIMES}
                </span>
              </div>
              <SpellBoxes
                word={word.word}
                value={spellings}
                onChange={setSpellings}
                className="mt-2 grid grid-cols-3 gap-2"
              />
            </div>
            <p className="mt-3 shrink-0 text-center text-xs text-zinc-600">Tap card to flip</p>
          </div>
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5"
          >
            <CardBack word={word} />
          </div>
        </motion.div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" size="md" className="rounded-2xl" onClick={onAgain} disabled={completing}>
          <RotateCw className="w-4 h-4" /> Again
        </Button>
        <Button
          variant="primary"
          size="md"
          className="rounded-2xl"
          onClick={onGotIt}
          disabled={completing || !spelled}
          title={spelled ? undefined : `Type the word ${SPELL_TIMES} times to unlock`}
        >
          <Check className="w-4 h-4" /> Got it
        </Button>
      </div>
    </motion.div>
  );
}

function CardBack({ word }: { word: Word }) {
  const dict = useDictionaryQuery(word.word);
  const translation = useWordTranslation(word);
  // No click guard here: the card flips back when the back is tapped, same as
  // the front. Only the controls below stop the click.
  return (
    <div>
      <h3 className="text-lg font-bold capitalize text-white">{word.word}</h3>
      {dict.data?.phonetic && (
        <p className="mt-0.5 text-sm tracking-wide text-zinc-500">{dict.data.phonetic}</p>
      )}
      {translation && <p className="mt-1 text-orange-300 font-semibold">{translation}</p>}
      {word.sentence && (
        <div className="mt-2 flex items-start gap-2">
          <p className="italic text-sm text-zinc-400">“{word.sentence}”</p>
          {canSpeak() && (
            <button
              onClick={(e) => { e.stopPropagation(); speak(word.sentence); }}
              aria-label="Read sentence"
              className="shrink-0 mt-0.5 text-orange-400 hover:text-orange-300"
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
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300"
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
