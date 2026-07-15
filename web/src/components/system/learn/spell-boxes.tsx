import { Check, X } from 'lucide-react';
import { speak } from '@/utils/speak';

// Each box carries its own verdict in colour, so the grid reads at a glance
// without parsing the icons: untouched boxes stay neutral, a match settles to
// emerald, a mismatch to rose. Orange (the app's action colour) is reserved for
// the box you're actually typing in.
const BOX_IDLE =
  'border-white/10 bg-black/30 text-white placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-black/50';
const BOX_OK = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-50 focus:border-emerald-400/70';
const BOX_BAD = 'border-rose-500/40 bg-rose-500/10 text-rose-50 focus:border-rose-400/70';

// The retype-to-learn gate: the learner types the word once per box, each box
// pronouncing it on focus and marking itself right or wrong. Shared by the word
// dialog and the study deck so both gates behave identically — only the box
// count and grid differ.
export function SpellBoxes({
  word,
  value,
  onChange,
  className = 'grid grid-cols-2 sm:grid-cols-4 gap-2',
}: {
  word: string;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const target = word.trim().toLowerCase();
  return (
    <div className={className}>
      {value.map((s, i) => {
        const filled = s.trim() !== '';
        const correct = s.trim().toLowerCase() === target;
        const tone = !filled ? BOX_IDLE : correct ? BOX_OK : BOX_BAD;
        return (
          <div key={i} className="relative">
            <input
              value={s}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              onFocus={() => speak(word)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={`#${i + 1}`}
              className={`w-full rounded-xl border px-3 py-2 pr-8 text-sm outline-none transition-colors ${tone}`}
            />
            {filled && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {correct ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <X className="w-4 h-4 text-rose-400" />
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
