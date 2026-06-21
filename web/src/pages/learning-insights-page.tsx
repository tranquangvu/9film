import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useWordStatsQuery } from '@/hooks/queries/use-words-query';
import { ProgressChart } from '@/components/system/learn/progress-chart';

export default function LearningInsightsPage() {
  const { isAuthenticated } = useAuth();
  const stats = useWordStatsQuery();

  // Personal vocabulary (the words saved while watching), matching the root page.
  const words = useMemo(
    () => (stats.data ?? []).filter((w) => (w.list ?? '') === ''),
    [stats.data],
  );
  const learned = words.filter((w) => w.completedAt).length;
  const toLearn = words.length - learned;

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
    <div className="min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl space-y-6">
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
          <ProgressChart words={words} />
        )}
      </div>
    </div>
  );
}
