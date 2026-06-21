import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Eye, Check, XCircle, CheckCircle2, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubmitTest } from '@/hooks/queries/use-tests-query';
import { speak, canSpeak } from '@/utils/speak';
import { wordColor } from '@/utils/word-color';
import { cn } from '@/utils/cn';
import type { Word, TestResult, TestSubmissionItem } from '@/services/user';

const STUDY_MS = 5000; // how long the word is shown before it vanishes
const VANISH_MS = 1300; // length of the magical hide animation
const SPELL_COUNT = 3; // how many times the word is retyped

type Phase = 'study' | 'vanish' | 'answer' | 'submitting' | 'done';

// A playful spelling + meaning self-test over one completed-date word group.
// Each word is shown for 5s, vanishes with a sparkle animation, then the learner
// retypes it 3× (pronounced on focus) and writes its meaning; the whole set is
// graded on submit (spelling locally, meanings by AI).
export function WordTest({
  words,
  list,
  groupLabel,
  onClose,
}: {
  words: Word[];
  list: string;
  groupLabel: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const submit = useSubmitTest();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('study');
  const [answers, setAnswers] = useState<TestSubmissionItem[]>([]);
  const [result, setResult] = useState<TestResult | null>(null);

  const current = words[index];
  const total = words.length;

  // Drive the study → vanish → answer timeline for the current word.
  useEffect(() => {
    if (phase === 'study') {
      speak(current?.word ?? '');
      const t = setTimeout(() => setPhase('vanish'), STUDY_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'vanish') {
      const t = setTimeout(() => setPhase('answer'), VANISH_MS);
      return () => clearTimeout(t);
    }
  }, [phase, current?.word]);

  function handleAnswer(spellings: string[], meaning: string) {
    const next = [...answers, { word: current.word, spellings, meaning }];
    setAnswers(next);
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setPhase('study');
    } else {
      finish(next);
    }
  }

  function finish(allAnswers: TestSubmissionItem[]) {
    setPhase('submitting');
    submit.mutate(
      { list, groupLabel, items: allAnswers },
      {
        onSuccess: (res) => {
          setResult(res);
          setPhase('done');
        },
        // Let the user retry the submit if grading fails.
        onError: () => setPhase('answer'),
      },
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-indigo-950/90 via-black/90 to-black/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={onClose}
        aria-label="Close test"
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-indigo-200/80 mb-1.5">
          <span className="truncate">{groupLabel} · spelling &amp; meaning test</span>
          <span>{phase === 'done' ? 'Done' : `Word ${Math.min(index + 1, total)} / ${total}`}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-orange-400"
            animate={{ width: `${total ? ((phase === 'done' ? total : index) / total) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'done' && result ? (
          <TestSummary
            key="summary"
            result={result}
            onClose={onClose}
            onViewAll={() => {
              onClose();
              navigate('/my-learning/tests');
            }}
          />
        ) : phase === 'submitting' ? (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="w-12 h-12 rounded-full border-[3px] border-white/15 border-t-orange-500 animate-spin" />
            <p className="text-indigo-100/80">Grading your answers…</p>
          </motion.div>
        ) : current ? (
          phase === 'answer' ? (
            <AnswerForm
              key={`answer-${index}`}
              word={current.word}
              onSubmit={handleAnswer}
            />
          ) : (
            <StudyCard
              key={`study-${index}`}
              word={current.word}
              sentence={current.sentence}
              vanishing={phase === 'vanish'}
              onReady={() => setPhase('vanish')}
            />
          )
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

// The 5-second memorize phase: the word (pronounced) with a shrinking timer ring,
// then a sparkle "poof" as each letter scatters away.
function StudyCard({
  word,
  sentence,
  vanishing,
  onReady,
}: {
  word: string;
  sentence: string;
  vanishing: boolean;
  onReady: () => void;
}) {
  const c = wordColor(word);
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="w-full max-w-md flex flex-col items-center text-center"
    >
      <p className="text-sm font-medium text-indigo-200/70 mb-6">
        {vanishing ? '✨ Memorize it!' : 'Memorize the spelling…'}
      </p>

      <div className="relative flex items-center justify-center min-h-[90px]">
        {/* The letters scatter with blur + spin when vanishing. */}
        <div className="flex items-center justify-center gap-0.5">
          {word.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="text-5xl md:text-6xl font-extrabold capitalize"
              style={{ color: c.color }}
              animate={
                vanishing
                  ? { opacity: 0, y: -60, scale: 1.9, filter: 'blur(10px)', rotate: (i % 2 ? 1 : -1) * 28 }
                  : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', rotate: 0 }
              }
              transition={{ duration: vanishing ? 0.85 : 0.3, delay: vanishing ? i * 0.05 : 0, ease: 'easeOut' }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </div>

        {/* Rising sparkles during the vanish. */}
        {vanishing &&
          ['✨', '⭐', '💫', '✨', '⭐'].map((s, i) => (
            <motion.span
              key={i}
              className="absolute text-2xl select-none"
              style={{ left: `${15 + i * 18}%` }}
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: -70, scale: 1.2 }}
              transition={{ duration: 1.1, delay: i * 0.08, ease: 'easeOut' }}
            >
              {s}
            </motion.span>
          ))}
      </div>

      {!vanishing && (
        <>
          <div className="mt-6 flex items-center gap-3">
            {canSpeak() && (
              <button
                onClick={() => speak(word)}
                aria-label="Pronounce word"
                className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Volume2 className="w-4 h-4" /> Hear it
              </button>
            )}
            <TimerRing key={word} durationMs={STUDY_MS} />
            <button
              onClick={onReady}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              I'm ready →
            </button>
          </div>
          {sentence && (
            <p className="mt-5 max-w-sm text-sm italic text-zinc-500">“{sentence.replace(new RegExp(word, 'ig'), '____')}”</p>
          )}
        </>
      )}
    </motion.div>
  );
}

// A shrinking circular countdown over the study window.
function TimerRing({ durationMs }: { durationMs: number }) {
  const [left, setLeft] = useState(Math.round(durationMs / 1000));
  useEffect(() => {
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative w-9 h-9">
      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <motion.circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="#fb923c"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={1}
          initial={{ pathLength: 1 }}
          animate={{ pathLength: 0 }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{left}</span>
    </div>
  );
}

// The recall phase: retype the (now hidden) word SPELL_COUNT times — each input
// pronounces the word on focus — plus the word's meaning in your own words.
function AnswerForm({
  word,
  onSubmit,
}: {
  word: string;
  onSubmit: (spellings: string[], meaning: string) => void;
}) {
  const [spellings, setSpellings] = useState<string[]>(() => Array(SPELL_COUNT).fill(''));
  const [meaning, setMeaning] = useState('');
  const [revealed, setRevealed] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setSpell = (i: number, v: string) =>
    setSpellings((prev) => prev.map((s, j) => (j === i ? v : s)));

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="w-full max-w-md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(spellings, meaning);
        }}
        className="rounded-3xl border border-white/10 bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Spell the word — 3 times</p>
          <button
            type="button"
            onMouseDown={() => setRevealed(true)}
            onMouseUp={() => setRevealed(false)}
            onMouseLeave={() => setRevealed(false)}
            onTouchStart={() => setRevealed(true)}
            onTouchEnd={() => setRevealed(false)}
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            aria-label="Peek at the word"
          >
            <Eye className="w-3.5 h-3.5" /> Peek
          </button>
        </div>
        {revealed && (
          <p className="mt-1 text-center text-lg font-bold capitalize" style={{ color: wordColor(word).color }}>
            {word}
          </p>
        )}

        <div className="mt-3 space-y-2.5">
          {spellings.map((s, i) => {
            const correct = s.trim().toLowerCase() === word.toLowerCase();
            return (
              <div key={i} className="relative">
                <input
                  ref={(el) => { refs.current[i] = el; }}
                  value={s}
                  onChange={(e) => setSpell(i, e.target.value)}
                  onFocus={() => speak(word)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={`Attempt ${i + 1}`}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-white outline-none transition-colors focus:border-orange-400/60"
                />
                {s.trim() !== '' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {correct ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-zinc-600" />
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <label className="text-sm font-semibold text-white">What does it mean?</label>
          <textarea
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            rows={2}
            placeholder="Type the meaning in your own words (any language)…"
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-white outline-none transition-colors focus:border-orange-400/60"
          />
        </div>

        <Button type="submit" variant="primary" size="md" className="mt-5 w-full rounded-2xl">
          Submit answer
        </Button>
      </form>
    </motion.div>
  );
}

// The end screen: spelling + meaning scores and a CTA to the results history.
function TestSummary({
  result,
  onClose,
  onViewAll,
}: {
  result: TestResult;
  onClose: () => void;
  onViewAll: () => void;
}) {
  const perfect = result.spellingCorrect === result.total && result.meaningCorrect === result.total;
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      className="w-full max-w-md text-center"
    >
      <div className="text-6xl mb-3 select-none">{perfect ? '🏆' : '🎯'}</div>
      <h2 className="text-2xl font-extrabold text-white">
        {perfect ? 'Perfect score!' : 'Test complete'}
      </h2>
      <p className="mt-1 text-indigo-200/80">Here's how you did.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ScorePill label="Spelling" value={result.spellingCorrect} total={result.total} icon={<Trophy className="w-4 h-4" />} />
        <ScorePill label="Meaning" value={result.meaningCorrect} total={result.total} icon={<CheckCircle2 className="w-4 h-4" />} />
      </div>

      <div className="mt-5 max-h-52 overflow-y-auto space-y-2 text-left">
        {result.items.map((it) => (
          <div key={it.word} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold capitalize text-white">{it.word}</span>
              <span className="flex items-center gap-2 text-xs">
                <span className={cn('font-medium', it.spellingScore === it.spellings.length ? 'text-emerald-400' : 'text-zinc-400')}>
                  {it.spellingScore}/{it.spellings.length} spelt
                </span>
                {it.meaningCorrect ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </span>
            </div>
            {it.feedback && <p className="mt-0.5 text-xs text-zinc-400">{it.feedback}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" size="md" className="rounded-2xl" onClick={onClose}>
          Done
        </Button>
        <Button variant="primary" size="md" className="rounded-2xl" onClick={onViewAll}>
          <Sparkles className="w-4 h-4" /> All results
        </Button>
      </div>
    </motion.div>
  );
}

function ScorePill({ label, value, total, icon }: { label: string; value: number; total: number; icon: React.ReactNode }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
        {icon} {label}
      </div>
      <p className="mt-1 text-2xl font-extrabold text-white">
        {value}<span className="text-base text-zinc-500">/{total}</span>
      </p>
      <p className="text-xs text-orange-300">{pct}%</p>
    </div>
  );
}
