// Give every saved word (or group) its own stable, "random" color. Deriving the
// hue from the string itself (instead of storing a color) keeps it consistent
// across reloads and devices with zero backend changes — the same string always
// gets the same hue. Colors are returned as translucent CSS values so the badges
// read as soft, glassy chips rather than solid blocks.

// Deterministic 32-bit string hash (FNV-1a style) — stable and well spread.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Spread the hue across the full 360° wheel using the golden-angle conjugate.
// Multiplying the hash by ~0.618 turns of the circle scatters even very similar
// inputs far apart, so neighbouring words rarely land on look-alike hues.
const GOLDEN_ANGLE = 0.618033988749895;

export interface WordColor {
  /** Soft translucent fill. */
  background: string;
  /** Slightly stronger translucent border. */
  borderColor: string;
  /** Bright, readable text/icon color. */
  color: string;
}

function chip(h: number, s: number, l: number): WordColor {
  return {
    background: `hsl(${h} ${s}% 60% / 0.14)`,
    borderColor: `hsl(${h} ${s}% 60% / 0.45)`,
    color: `hsl(${h} ${Math.min(s + 5, 95)}% ${l}%)`,
  };
}

/** Stable translucent color triple for a saved word, keyed on the word text. */
export function wordColor(word: string): WordColor {
  const n = hash(word.trim().toLowerCase());
  // Hue: scatter around the full wheel with the golden angle.
  const h = Math.round(((n * GOLDEN_ANGLE) % 1) * 360);
  // Nudge saturation/lightness from independent hash bits so two strings that
  // happen to share a hue still read as visibly different chips.
  const s = 70 + ((n >>> 8) % 22); // 70–91%
  const l = 70 + ((n >>> 16) % 14); // 70–83% (text)
  return chip(h, s, l);
}
