import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StudyDeck } from '@/components/system/learn/study-deck';
import { useInfiniteWordsQuery } from '@/hooks/queries/use-words-query';

// The "Study" session over a list's to-learn words. The deck pulls more pages as
// it progresses, so a large imported list (Oxford 3000) is fully studyable
// without loading everything up front.
export function StudySession({
  list = '',
  total,
  open,
  onClose,
}: {
  list?: string;
  total: number;
  open: boolean;
  onClose: () => void;
}) {
  const learnList = useInfiniteWordsQuery('learn', list);
  const words = useMemo(() => learnList.data?.pages.flatMap((p) => p.items) ?? [], [learnList.data]);
  return (
    <AnimatePresence>
      {open && (
        <StudyDeck
          words={words}
          total={total}
          hasMore={!!learnList.hasNextPage}
          fetchMore={learnList.fetchNextPage}
          loading={learnList.isLoading}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}
