import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

// One looked-up card field (phonetic, translation). Shows a bar while the
// lookup is in flight and a dash when it came back with nothing, so the card
// never silently drops a line — and never reflows when the value lands.
//
// The bar lives inside the same <p> the text would occupy, and is sized in `em`,
// so the line box is identical whether the field is loading, filled, or empty —
// only the width is per-field. Callers pass no height.
export function CardField({
  value,
  loading,
  className,
  skeletonWidth = 'w-24',
  style,
}: {
  value: string | undefined;
  loading: boolean;
  className?: string;
  skeletonWidth?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p className={className} style={!loading && value ? style : undefined}>
      {loading ? (
        // A span, not the Skeleton div — a div inside <p> is invalid nesting.
        <span
          className={`skeleton inline-block h-[0.85em] rounded-full align-[-0.05em] ${skeletonWidth}`}
        />
      ) : (
        value || <span className="text-zinc-600">~~</span>
      )}
    </p>
  );
}

// Placeholder shown while a deck's words are still loading. Mirrors the real
// card's geometry — same width, height, radius, and action row — so the card
// swaps in without the layout jumping.
export function DeckSkeleton({
  height,
  actions = 2,
  wordSize = 'text-5xl',
}: {
  height: string; // the deck's card height class, so both match exactly
  actions?: number; // buttons under the card (2 for study, 1 for review)
  wordSize?: string; // the deck's word type scale, so the bar matches its line box
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-md"
      role="status"
      aria-label="Loading words"
    >
      {/* Each bar sits in the same type scale as the line it stands in for — the
          word, then the two CardFields — so the whole stack matches a real card. */}
      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-3xl border border-white/10 bg-surface p-5 ${height}`}
      >
        <p className={`${wordSize} font-bold leading-tight`}>
          <span className="skeleton inline-block h-[0.85em] w-40 rounded-2xl align-[-0.05em]" />
        </p>
        <CardField value="" loading className="text-sm tracking-wide" skeletonWidth="w-20" />
        <CardField value="" loading className="text-base font-semibold" skeletonWidth="w-28" />
      </div>
      {/* h-10 = Button size="md" (py-2.5 + text-sm), so the row doesn't resize. */}
      <div className={`mt-5 grid gap-3 ${actions === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-2xl" />
        ))}
      </div>
    </motion.div>
  );
}
