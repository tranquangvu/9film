// Give every saved word its own stable, "random" color. Deriving the hue from
// the word itself (instead of storing a color) keeps it consistent across
// reloads and devices with zero backend changes — the same word always gets
// the same hue. Colors are returned as translucent CSS values so the badges
// read as soft, glassy chips rather than solid blocks.

// A small curated set of pleasant hues (degrees). Hand-picked so neighbouring
// words rarely clash and every hue stays vivid on the dark surface.
const HUES = [
  4, // red
  18, // coral
  32, // orange
  45, // amber
  140, // green
  160, // emerald
  175, // teal
  190, // cyan
  205, // sky
  220, // blue
  255, // indigo
  275, // violet
  290, // purple
  320, // fuchsia
  340, // pink
];

// Deterministic 32-bit string hash (FNV-1a style) — stable and well spread.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface WordColor {
  /** Soft translucent fill. */
  background: string;
  /** Slightly stronger translucent border. */
  borderColor: string;
  /** Bright, readable text/icon color. */
  color: string;
}

/** Stable translucent color triple for a saved word, keyed on the word text. */
export function wordColor(word: string): WordColor {
  const h = HUES[hash(word.trim().toLowerCase()) % HUES.length];
  return {
    background: `hsl(${h} 85% 60% / 0.14)`,
    borderColor: `hsl(${h} 85% 60% / 0.45)`,
    color: `hsl(${h} 90% 78%)`,
  };
}
