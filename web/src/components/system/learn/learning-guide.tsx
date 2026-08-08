import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SECTION_SIZE } from '@/components/system/learn/section-break';
import { SPELL_TIMES } from '@/components/system/learn/study-deck';
import { TEST_SPELL_COUNT } from '@/components/system/learn/word-test';

// The numbers here are read from the components that enforce them rather than
// written out, so the guide can't drift from what the decks actually do.
const STEPS: { title: string; body: string }[] = [
  {
    title: 'Collect words while you watch',
    body: 'Tap any word in the subtitles and it lands in your vocabulary, together with the line it came from and the exact moment in the scene — so you can always jump back and hear it again. No time to watch? Import a ready-made pack like the Oxford 3000 instead.',
  },
  {
    title: 'Study until it sticks',
    body: `New words wait in the Study tab. Each card shows the word, its pronunciation and meaning; flip it for definitions and the original scene. Retype the word ${SPELL_TIMES} times to unlock "Got it" — that's what moves it to Completed. Not ready? "Again" drops it to the back of the deck. Sessions run in batches of ${SECTION_SIZE} with a breather in between. Saved idioms skip the typing, since spelling out a whole phrase is punishment, not practice.`,
  },
  {
    title: 'Let spaced repetition do the remembering',
    body: 'The moment a word is learned it gets a review date — the first one tomorrow. Review shows the words due today: recall the meaning, then rate yourself. Again resets it, Hard brings it back sooner, Good pushes it further out, Easy parks it the longest. Rate honestly and the schedule tightens on exactly the words you keep forgetting.',
  },
  {
    title: 'Test yourself for real',
    body: `Make test, on the Completed tab, checks a group properly: memorise the word, watch it vanish, then retype it ${TEST_SPELL_COUNT} times from memory and write what it means. Spelling is marked instantly and the meaning is graded by AI, so a rough-but-right answer still counts. Every score is kept under Test results.`,
  },
  {
    title: 'Keep the streak alive',
    body: 'Your streak counts the days in a row you saved or learned at least one word. Miss a day and it resets — a handful of words beats a marathon once a week.',
  },
];

// "How does this work?" for the learning system — the flow spans four different
// screens (subtitles, Study, Review, Make test), so nothing on any single one of
// them explains the whole loop.
export function LearningGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How learning works"
          className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-emerald-200/50 transition-colors hover:bg-white/5 hover:text-emerald-100"
        >
          <Info className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>How learning works</DialogTitle>
        <DialogDescription className="mt-1">
          Five steps, from a word you just heard to one you never forget.
        </DialogDescription>
        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/15 text-xs font-bold text-emerald-300">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
