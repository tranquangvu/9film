import { motion } from 'framer-motion';
import { ArrowRight, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';

// How many words make up one study/review section. Both decks pace themselves in
// runs of this many words, pausing on a SectionBreak in between so a big list
// (Oxford 3000, a large due queue) has natural stopping points.
export const SECTION_SIZE = 10;

// The interstitial shown between sections: "you finished this batch of 10 — keep
// going or take a break?". Mirrors the DeckDone / ReviewDone look so the pause
// feels like part of the same game.
export function SectionBreak({
  sectionIndex,
  doneCount,
  onContinue,
  onClose,
}: {
  sectionIndex: number; // 1-based number of the section just finished
  doneCount: number; // words done in the section just finished
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      className="text-center"
    >
      <div className="text-7xl mb-4 select-none">🎉</div>
      <h2 className="text-2xl font-extrabold text-white">Section {sectionIndex} done!</h2>
      <p className="mt-1 text-emerald-200/80">
        That's {doneCount} more {doneCount === 1 ? 'word' : 'words'}. Keep the momentum going?
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="primary" size="md" className="rounded-2xl" onClick={onContinue}>
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="md" className="rounded-2xl" onClick={onClose}>
          <Coffee className="w-4 h-4" /> Take a break
        </Button>
      </div>
    </motion.div>
  );
}
