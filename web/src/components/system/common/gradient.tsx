import { cn } from '@/utils/cn';

// Shared orange gradient used by the rating star and favorite heart icons.
// `fill`/`stroke` reference the gradient by id; render <OrangeGradient />
// somewhere in the same component so the def exists in the DOM.
export const ORANGE_GRADIENT_ID = 'icon-grad-orange';
export const ORANGE_GRADIENT_FILL = `url(#${ORANGE_GRADIENT_ID})`;

export function OrangeGradient() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id={ORANGE_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// A coloured wash behind the top of a page. Putting the gradient on the page
// container instead stretches it over the full scroll height, so a long list
// (the Oxford 3000, a big test history) ends up tinted end to end; this stays
// anchored to the first screenful whatever the content does.
//
// The page container needs `relative` and its own background; pass the start
// colour as `from-…` (e.g. `from-emerald-950/40`).
export function PageGradient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b to-transparent',
        className,
      )}
    />
  );
}
