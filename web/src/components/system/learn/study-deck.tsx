import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, RotateCw, Check, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompleteWord } from '@/hooks/queries/use-words-query';
import { useDictionaryQuery } from '@/hooks/queries/use-dictionary-query';
import { useWordTranslation } from '@/hooks/queries/use-translate-query';
import { useExplainPhrase } from '@/hooks/queries/use-explain-phrase-query';
import { SpellBoxes } from '@/components/system/learn/spell-boxes';
import { SectionBreak, SECTION_SIZE } from '@/components/system/learn/section-break';
import { CardField, DeckSkeleton } from '@/components/system/learn/deck-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { speak, canSpeak } from '@/utils/speak';
import type { Word } from '@/services/user';
import { isSpelled, spelledCount, sceneLink, wordColor } from '@/utils/word';

// Times the word must be retyped before "Got it" unlocks. Exported so the
// learning guide quotes the real number instead of restating it.
export const SPELL_TIMES = 6;
// Shared by the card and its loading skeleton so the swap doesn't shift layout.
const CARD_H = 'h-[min(320px,calc(100vh-14rem))]';

// A playful flip-card study game. The front shows the word; flipping reveals the
// meaning and the retype boxes. "Got it" marks the word learned once they all
// match; "Again" requeues it to the back for another pass this session.
export function StudyDeck({
  words,
  total,
  hasMore,
  fetchMore,
  onClose,
  startWord,
  loading = false,
}: {
  words: Word[];
  total: number;
  hasMore: boolean;
  fetchMore: () => void;
  onClose: () => void;
  // First page still in flight — show the skeleton instead of an empty deck,
  // which would otherwise read as "All done!".
  loading?: boolean;
  // Open on this word rather than the first — how tapping a word in the list
  // gets straight to its card, with the rest of the list still behind it.
  startWord?: string;
}) {
  // The queue is a growing list of word keys; current card data is read live from
  // `words` so a word edited mid-study shows its latest state.
  const [queue, setQueue] = useState<string[]>(() => words.map((w) => w.word));
  const [pos, setPos] = useState(() => {
    const i = startWord ? words.findIndex((w) => w.word === startWord) : 0;
    return i > 0 ? i : 0;
  });
  const [flipped, setFlipped] = useState(false);
  const [learned, setLearned] = useState(0);
  // Section pacing: run through the deck in batches of SECTION_SIZE words, pausing
  // on a break screen between them. `sectionDone` counts words learned in the
  // current batch (a re-queued "Again" doesn't count — it's the same word again).
  // Only armed once the deck is bigger than one section.
  const [paused, setPaused] = useState(false);
  const [sectionDone, setSectionDone] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(1);
  const sectioned = total > SECTION_SIZE;
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
  const finished = !loading && pos >= queue.length && !hasMore;
  const loadingMore = pos >= queue.length && hasMore;

  function gotIt() {
    if (!current) return;
    complete.mutate(current.word);
    setLearned((n) => n + 1);
    setFlipped(false);
    // A full section just filled — pause here unless this was the final card
    // (the last word always ends on StudyDone, never a break).
    const doneInSection = sectionDone + 1;
    const wasLast = pos >= queue.length - 1 && !hasMore;
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
        <div className="flex h-4 items-center justify-between text-xs font-medium text-emerald-200/80 mb-1.5">
          {loading ? (
            <Skeleton className="h-3 w-28 rounded-full" />
          ) : (
            <span>{Math.min(learned, total)} / {total} learned</span>
          )}
          <span>
            {finished
              ? 'Done'
              : paused
                ? 'Break'
                : sectioned
                  ? `Section ${sectionIndex} · ${sectionDone}/${SECTION_SIZE}`
                  : ''}
          </span>
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
        {loading || loadingMore ? (
          <DeckSkeleton key="loading" height={CARD_H} />
        ) : paused ? (
          <SectionBreak
            key={`break-${sectionIndex}`}
            sectionIndex={sectionIndex}
            doneCount={SECTION_SIZE}
            onContinue={continueSection}
            onClose={onClose}
          />
        ) : finished ? (
          <StudyDone key="done" learned={learned} onClose={onClose} />
        ) : current ? (
          <StudyCard
            key={currentKey}
            word={current}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onGotIt={gotIt}
            onAgain={again}
            completing={complete.isPending}
          />
        ) : (
          // Live word vanished (e.g. completed elsewhere) — skip to the next card.
          <StudySkip key={`skip-${pos}`} onSkip={() => setPos((p) => p + 1)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StudyCard({
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
  // Idioms skip the retype gate — typing "disagree with doing" six times is
  // punishing, and the self-test excludes phrases for the same reason.
  const isPhrase = word.kind === 'phrase';
  const translation = useWordTranslation(word);
  // Shares the back's cached lookup (same query key), so this costs no request.
  const dict = useDictionaryQuery(isPhrase ? undefined : word.word);
  // Same retype gate as the word dialog: "Got it" unlocks once every box matches.
  // The parent keys this component by word, so the boxes clear on each new card.
  const [spellings, setSpellings] = useState<string[]>(() => Array(SPELL_TIMES).fill(''));
  const done = spelledCount(word.word, spellings);
  const spelled = isPhrase || isSpelled(word.word, spellings);
  const color = wordColor(word.word);
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
            className="absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5"
          >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
              <p className="relative">
                <span
                  className="text-center text-5xl font-bold capitalize leading-tight tracking-tight break-words"
                  style={{ color }}
                >
                  {word.word}
                </span>
                {canSpeak() && (
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                    aria-label="Pronounce"
                    style={{ color }}
                    className="absolute top-2 -right-9 shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/5"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
              </p>
              {/* Idioms have no dictionary entry, so no phonetic line at all. */}
              {!isPhrase && (
                <CardField
                  value={dict.data?.phonetic}
                  loading={dict.isLoading}
                  className="text-sm tracking-wide text-zinc-500"
                  skeletonWidth="w-20"
                />
              )}
              <CardField
                value={translation.text}
                loading={translation.isLoading}
                className="text-center text-base font-semibold"
                skeletonWidth="w-28"
                style={{ color }}
              />
            </div>
            {!isPhrase && (
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
                  accent={color}
                  className="mt-2 grid grid-cols-3 gap-2"
                />
              </div>
            )}
            <p className="mt-3 shrink-0 text-center text-xs text-zinc-600">Tap card to flip</p>
          </div>
          <div
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            className="absolute inset-0 overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5"
          >
            <StudyBack word={word} />
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
          // Word-colour background; wordColor is a light pastel so the label goes
          // dark for contrast, and the orange shadow is dropped to suit.
          className="rounded-2xl text-zinc-950 shadow-none"
          style={{ backgroundColor: color }}
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

function StudyBack({ word }: { word: Word }) {
  // Idioms have no dictionary entry, so they get an AI breakdown in place of
  // the definitions list.
  const isPhrase = word.kind === 'phrase';
  const dict = useDictionaryQuery(isPhrase ? undefined : word.word);
  const explain = useExplainPhrase(isPhrase ? word.word : null, word.sentence ?? '');
  const translation = useWordTranslation(word);
  const color = wordColor(word.word);
  // No click guard here: the card flips back when the back is tapped, same as
  // the front. Only the controls below stop the click.
  return (
    <div>
      <h3 className="text-lg font-bold capitalize" style={{ color }}>{word.word}</h3>
      {!isPhrase && (
        <CardField
          value={dict.data?.phonetic}
          loading={dict.isLoading}
          className="mt-0.5 text-sm tracking-wide text-zinc-500"
          skeletonWidth="w-20"
        />
      )}
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
      {isPhrase && (
        <div className="mt-3 space-y-2.5">
          {explain.isLoading && <p className="text-sm text-zinc-600">Explaining…</p>}
          {explain.data?.literal && <ExplainBlock label="Literally" text={explain.data.literal} />}
          {explain.data?.figurative && <ExplainBlock label="Figuratively" text={explain.data.figurative} />}
          {explain.data?.usage && <ExplainBlock label="Usage" text={explain.data.usage} />}
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

function ExplainBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-200">{text}</p>
    </div>
  );
}

function StudyDone({ learned, onClose }: { learned: number; onClose: () => void }) {
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

function StudySkip({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="text-center text-zinc-400">
      <p>This word is no longer in your list.</p>
      <Button variant="ghost" size="sm" className="mt-3 rounded-full" onClick={onSkip}>
        Next
      </Button>
    </div>
  );
}
