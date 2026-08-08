import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normId } from '@/utils/title';
import type { LetterGroup, TitleGroup } from '@/utils/word';
import type { Word } from '@/services/user';

export function WordBadge({ word, onClick }: { word: Word; onClick: () => void }) {
  return (
    <Badge variant="tag" onClick={onClick} className="capitalize">
      {word.word}
    </Badge>
  );
}

// An A–Z index of a word pack. Each letter is its own card so the sections read
// as separate blocks rather than one endless field of pills, and the letter bar
// sticks while you scroll — a single letter can run ~200 words, far taller than
// the viewport, so a header that scrolls away leaves you with no idea where you
// are. It parks under the h-16 navbar; no `overflow-hidden` on the card, which
// would make an ancestor scroll container and kill the stickiness.
export function WordLetterGroupList({
  groups,
  onSelect,
}: {
  groups: LetterGroup[];
  onSelect: (w: Word) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <motion.section
          key={g.letter}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-white/[0.02]"
        >
          {/* Near-opaque, not glass: pills sliding under a translucent bar ghost
              through it and turn the letter into visual noise. */}
          <div className="sticky top-16 z-20 flex items-center gap-3 rounded-t-3xl border-b border-white/10 bg-[#101010]/95 px-4 py-3 backdrop-blur-md md:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-400/25 to-emerald-500/5 text-xl font-extrabold leading-none text-emerald-200">
              {g.letter}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 p-4 md:p-5">
            {g.words.map((w) => (
              <WordBadge key={w.word} word={w} onClick={() => onSelect(w)} />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}

export function WordTitleGroupList({
  groups,
  onSelect,
  onTest,
}: {
  groups: TitleGroup[];
  onSelect: (w: Word) => void;
  onTest?: (g: TitleGroup, label: string) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const label = g.title || g.imdbId || 'Saved words';
        return (
          <motion.div key={g.imdbId || 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              {g.imdbId ? (
                <Link
                  to={`/title/${normId(g.imdbId)}`}
                  className="min-w-0 truncate text-sm font-medium text-zinc-200 hover:text-white"
                >
                  {label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-zinc-300">{label}</span>
              )}
              <span className="shrink-0 text-xs text-zinc-600">
                <span className="mr-2">|</span>
                {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
              </span>
              {onTest && (
                <button
                  onClick={() => onTest(g, label)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Test
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.words.map((w) => (
                <WordBadge key={w.word} word={w} onClick={() => onSelect(w)} />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
