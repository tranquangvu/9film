// Shared orange gradient used by the rating star and favorite heart icons.
// `fill`/`stroke` reference the gradient by id; render <OrangeGradientDefs />
// somewhere in the same component so the def exists in the DOM.
export const ORANGE_GRADIENT_ID = 'icon-grad-orange';
export const ORANGE_GRADIENT_FILL = `url(#${ORANGE_GRADIENT_ID})`;

export function OrangeGradientDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {/* bright, vertical light-to-deep orange */}
        <linearGradient id={ORANGE_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}
