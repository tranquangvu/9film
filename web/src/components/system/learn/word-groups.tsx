import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
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

const ACTION =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors';

// Right-hand control cluster of a section header. One `ml-auto` for the whole
// group, never one per button: sibling auto margins *split* the free space
// between them rather than the first taking it all, which strands the buttons
// mid-row instead of grouping them on the right.
function SectionControls({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>;
}

// An A–Z index of a word pack — the same bare header-then-pills rhythm as the
// title sections, no card. What marks the boundaries instead is the rule running
// off the header to the right edge: one letter can be hundreds of pills long, so
// without it a new section is just another row in an unbroken field. The extra
// leading above each header does the rest.
export function WordLetterGroupList({
  groups,
  onSelect,
}: {
  groups: LetterGroup[];
  onSelect: (w: Word) => void;
}) {
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <motion.section key={g.letter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-gradient-to-br from-emerald-400/30 to-emerald-500/5 text-base font-extrabold leading-none text-emerald-300">
              {g.letter}
            </span>
            {/* Same count style as the title sections, separator and all. */}
            <span className="shrink-0 text-xs text-zinc-600">
              <span className="mr-2">|</span>
              {g.words.length} {g.words.length === 1 ? 'word' : 'words'}
            </span>
            <div className="ml-1 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
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
    <div className="space-y-8">
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
              {/* Same section rule as the A–Z list. It takes the row's slack, so
                  SectionControls' own `ml-auto` is a harmless no-op and the
                  button still lands hard right. */}
              <div className="ml-1 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              <SectionControls>
                {onTest && (
                  <button
                    onClick={() => onTest(g, label)}
                    className={`${ACTION} border-indigo-400/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25`}
                  >
                    {/* Clipboard family, pairing with the hero's ClipboardList
                        "Test results" — the action and its history read as one
                        feature. Not the cap: that belongs to the Study tab. */}
                    <ClipboardCheck className="w-3.5 h-3.5" /> Make test
                  </button>
                )}
              </SectionControls>
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
