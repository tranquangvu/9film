import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useWordStatsQuery } from '@/hooks/queries/use-words-query';
import { useTestsQuery } from '@/hooks/queries/use-tests-query';
import { PageGradient } from '@/components/system/common/gradient';
import {
  ProgressChart,
  NEW_WORDS_COLOR,
  COMPLETED_COLOR,
  TESTS_COLOR,
} from '@/components/system/learn/progress-chart';

export default function MyLearningInsightsPage() {
  const stats = useWordStatsQuery();

  // Personal vocabulary (the words saved while watching), matching the root page.
  const words = useMemo(
    () => (stats.data ?? []).filter((w) => (w.list ?? '') === ''),
    [stats.data],
  );
  const learned = words.filter((w) => w.completedAt).length;
  const toLearn = words.length - learned;

  const tests = useTestsQuery();
  const wordSeries = useMemo(
    () => [
      { label: 'New words', color: NEW_WORDS_COLOR, dates: words.map((w) => w.createdAt) },
      { label: 'Completed words', color: COMPLETED_COLOR, dates: words.map((w) => w.completedAt) },
    ],
    [words],
  );
  const testSeries = useMemo(
    () => [
      {
        label: 'Tests completed',
        color: TESTS_COLOR,
        dates: (tests.data ?? []).map((t) => t.createdAt),
      },
    ],
    [tests.data],
  );


  return (
    <div className="relative min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <PageGradient className="from-indigo-950/40" />
      {/* Positioned so the content paints above the wash. */}
      <div className="relative mx-auto max-w-3xl space-y-6">
        <Link to="/my-learning" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft className="w-4 h-4" /> My Learning
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your insights</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {learned} learned · {toLearn} to learn · {words.length} total
          </p>
        </div>

        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : words.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400">
            <p>No activity yet. Save words while watching to see your progress here.</p>
          </div>
        ) : (
          <>
            <ProgressChart title="Words" series={wordSeries} />
            <ProgressChart title="Tests" series={testSeries} />
          </>
        )}
      </div>
    </div>
  );
}
