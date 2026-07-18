import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normId } from '@/utils/title';
import type { TitleGroup } from '@/utils/word';
import type { Word } from '@/services/user';

export function WordBadge({ word, onClick }: { word: Word; onClick: () => void }) {
  return (
    <Badge variant="tag" onClick={onClick} className="capitalize">
      {word.word}
    </Badge>
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
