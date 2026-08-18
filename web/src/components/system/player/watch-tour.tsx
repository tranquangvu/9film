import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

// Set once the tour is skipped or walked to the end; a reload before that
// replays it from the start.
const DONE_KEY = '9film:watch-tour-done';

// Keyboard focus is orange like the rest of the app (see ui/select). The solid
// Next button rings on its own dark card instead, so it reads against orange.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:text-white';
const FOCUS_SOLID =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900';

interface TourStep {
  /** matches a `data-tour="…"` attribute on the target element */
  target: string;
  title: string;
  body: string;
}

// Walkthrough of the watch page: the header controls in the order they sit in,
// left to right, and then the film itself. Steps whose target isn't in the DOM
// (no subtitles, not a series, learning mode off) are skipped automatically.
const STEPS: TourStep[] = [
  {
    target: 'episodes',
    title: 'Jump around',
    body: 'Pick a season and episode. A dot marks the ones you’ve already watched.',
  },
  {
    target: 'source',
    title: 'Trouble playing?',
    body: "If the video won't start or buffers, switch to another source here.",
  },
  {
    target: 'transcript',
    title: 'Learn while you watch',
    body: 'Open the transcript to read along. Click any word to save it to your vocabulary.',
  },
  {
    target: 'subtitles',
    title: 'Captions',
    body: 'Pick a subtitle track — it also feeds the transcript. Tracks are timed against a specific release, so if the lines drift out of sync, switch to another one until it matches.',
  },
  {
    target: 'interactive-subtitles',
    title: 'Every line is clickable',
    body: 'Rest the pointer on a line and the film pauses so you can read it. Click a word for its meaning, translation and a button to save it — or drag across several words to keep a whole phrase.',
  },
];

// Wide enough for the whole footer — dots, Skip tour, Back and Next — to sit on
// one line. At 300 "Skip tour" wrapped.
const CARD_W = 340;

type Rect = { top: number; left: number; width: number; height: number };

function rectOf(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * One-time spotlight tour for the watch page. Renders nothing once completed
 * (persisted in localStorage). `enabled` should flip true only when the player
 * is ready, so the highlighted controls are actually on screen.
 */
export function WatchTour({
  enabled,
  onActiveTarget,
}: {
  enabled: boolean;
  /** The `data-tour` value being highlighted right now, or null. The page uses
   *  it to lift that control above the orange wash. */
  onActiveTarget?: (target: string | null) => void;
}) {
  const [done, setDone] = useState(() => localStorage.getItem(DONE_KEY) === '1');
  // Steps present in the current DOM, resolved once when the tour starts.
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const active = enabled && !done && steps.length > 0;

  // Resolve which steps have a target rendered, then start.
  useEffect(() => {
    if (done || !enabled || steps.length > 0) return;
    // Let the header controls mount/measure first.
    const t = setTimeout(() => {
      const present = STEPS.filter((s) => rectOf(s.target));
      if (present.length > 0) {
        setIndex(0);
        setSteps(present);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [done, enabled, steps.length]);

  const finish = useCallback(() => {
    localStorage.setItem(DONE_KEY, '1');
    setDone(true);
  }, []);

  const step = steps[index];

  // Measure the active target; keep it in sync on resize/scroll.
  useLayoutEffect(() => {
    if (!active || !step) return;
    const measure = () => setRect(rectOf(step.target));
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step]);

  // Publish the highlighted target (and clear it when the tour ends).
  useEffect(() => {
    onActiveTarget?.(active && step ? step.target : null);
    return () => onActiveTarget?.(null);
  }, [active, step, onActiveTarget]);

  const next = useCallback(() => {
    if (!step) return;
    // Re-resolve first: a control can mount after the tour started (subtitles
    // land when their search returns), and it should join the walkthrough
    // instead of the tour ending one step in.
    const present = STEPS.filter((s) => rectOf(s.target));
    const at = present.findIndex((s) => s.target === step.target);
    if (at < 0 || at >= present.length - 1) finish();
    else {
      setSteps(present);
      setIndex(at + 1);
    }
  }, [step, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Targets keep arriving after the tour starts: the subtitle picker fills when
  // its search returns, and the clickable line only exists once the cues are
  // parsed — a good ten seconds in. next() re-resolves too, but someone who
  // clicks straight through would be finished before either mounted, and the
  // tour is one-time. So watch for them while it runs, holding the reader on
  // whatever step they are reading.
  useEffect(() => {
    if (!active || !step) return;
    const id = setInterval(() => {
      const present = STEPS.filter((s) => rectOf(s.target));
      if (present.length === steps.length) return;
      const at = present.findIndex((s) => s.target === step.target);
      if (at < 0) return; // the current target went away; next() handles that
      setSteps(present);
      setIndex(at);
    }, 800);
    return () => clearInterval(id);
  }, [active, step, steps.length]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish, next, back]);

  if (!active || !step || !rect) return null;

  const PAD = 4;
  const hole = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // Place the card below the target by default; flip above if it would clip.
  const below = hole.top + hole.height + 12;
  const placeBelow = below + 180 < window.innerHeight;
  const cardTop = placeBelow ? below : Math.max(12, hole.top - 12 - 180);
  const cardLeft = Math.min(
    Math.max(12, hole.left + hole.width / 2 - CARD_W / 2),
    window.innerWidth - CARD_W - 12,
  );

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Watch page tour">
      {/* Dim everything except the spotlight hole (box-shadow scrim trick). */}
      <motion.div
        key={step.target}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={
          'pointer-events-auto absolute bg-orange-500/40 ring-2 ring-orange-400 ' +
          // A pill fits the header controls, round or lozenge-shaped alike. Only
          // something as wide and low as the subtitle band needs a rectangle —
          // a full pill there would curve its ends in over the words.
          (hole.width > hole.height * 4 ? 'rounded-2xl' : 'rounded-full')
        }
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
        }}
        onClick={(e) => e.stopPropagation()}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: placeBelow ? -8 : 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="absolute rounded-2xl border border-white/12 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur"
          style={{ top: cardTop, left: cardLeft, width: CARD_W }}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
              <Sparkles size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{step.body}</p>
            </div>
            <button
              onClick={finish}
              aria-label="Skip tour"
              className={`-mr-1 -mt-1 ml-auto rounded-full p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white ${FOCUS}`}
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={
                    'h-1.5 rounded-full transition-all ' +
                    (i === index ? 'w-4 bg-orange-400' : 'w-1.5 bg-white/25')
                  }
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={finish}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white ${FOCUS}`}
              >
                Skip tour
              </button>
              {index > 0 && (
                <button
                  onClick={back}
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white ${FOCUS}`}
                >
                  <ArrowLeft size={13} /> Back
                </button>
              )}
              <button
                onClick={next}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-400 ${FOCUS_SOLID}`}
              >
                {index === steps.length - 1 ? 'Got it' : 'Next'}
                {index < steps.length - 1 && <ArrowRight size={13} />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
