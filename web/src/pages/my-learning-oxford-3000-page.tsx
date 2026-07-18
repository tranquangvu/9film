import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useWordStatsQuery, useImportWordList } from '@/hooks/queries/use-words-query';
import { PageGradient } from '@/components/system/common/gradient';
import { LearningHero } from '@/components/system/learn/learning-hero';
import { StudySession } from '@/components/system/learn/study-session';
import { WordCollection } from '@/components/system/learn/word-collection';
import { computeStreak } from '@/utils/word';

// The list key the backend stores these words under (see learning/repo.go).
const LIST = 'oxford3000';

// Empty state: one tap imports the whole list.
function ImportCard() {
  const importList = useImportWordList();
  return (
    <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-transparent p-10 text-center">
      <div className="text-6xl mb-3 select-none">📚</div>
      <p className="font-bold text-white text-lg">The Oxford 3000</p>
      <p className="text-sm text-emerald-100/60 mt-1 mb-5">
        Add the 3000 most important English words, then study them as flashcards.
      </p>
      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
        <Button
          variant="primary"
          size="sm"
          disabled={importList.isPending}
          onClick={() => importList.mutate(LIST)}
        >
          <Plus className="w-4 h-4" />
          {importList.isPending ? 'Adding…' : 'Add the Oxford 3000'}
        </Button>
      </motion.div>
    </div>
  );
}

export default function MyLearningOxford3000() {
  const { isAuthenticated } = useAuth();
  const stats = useWordStatsQuery();
  const [studying, setStudying] = useState(false);

  // Stats cover the whole vocabulary; this page only shows the imported pack.
  const all = useMemo(() => (stats.data ?? []).filter((w) => w.list === LIST), [stats.data]);
  const addedCount = useMemo(() => all.filter((w) => !w.completedAt).length, [all]);
  const completedCount = useMemo(() => all.filter((w) => w.completedAt).length, [all]);
  const streak = useMemo(() => computeStreak(all), [all]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 text-center text-zinc-400">
        <p>
          Please <Link to="/login" className="text-orange-400">sign in</Link> to use your vocabulary.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <PageGradient className="from-emerald-950/40" />
      {/* Positioned so the content paints above the wash. */}
      <div className="relative mx-auto max-w-3xl">
        <Link to="/my-learning" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-4">
          <ChevronLeft className="w-4 h-4" /> My Learning
        </Link>
        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          <ImportCard />
        ) : (
          <div className="space-y-6">
            <LearningHero
              title="The Oxford 3000"
              subtitle="The essential English words — learn them as flashcards."
              addedCount={addedCount}
              streak={streak}
              // SRS reviews are global (any list); they live on the main page.
              dueCount={0}
              onStudy={() => setStudying(true)}
              testsTo="/my-learning/test-results"
            />

            <WordCollection
              list={LIST}
              flatLearn
              addedCount={addedCount}
              completedCount={completedCount}
            />
          </div>
        )}
      </div>

      <StudySession list={LIST} total={addedCount} open={studying} onClose={() => setStudying(false)} />
    </div>
  );
}
