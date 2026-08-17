import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Clapperboard, Film } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useWordStatsQuery, useDueCount } from '@/hooks/queries/use-words-query';
import { PageGradient } from '@/components/system/common/gradient';
import { LearningHero } from '@/components/system/learn/learning-hero';
import { StarterPack } from '@/components/system/learn/starter-pack';
import { StudySession } from '@/components/system/learn/study-session';
import { WordCollection } from '@/components/system/learn/word-collection';
import { ReviewDeck } from '@/components/system/learn/review-deck';
import { computeStreak } from '@/utils/word';

// The other half of an empty page: the starter packs above are the shortcut,
// this is the way the app is actually meant to be used. It stands where the
// word collection will be once there is one, in the same section rhythm as
// StarterPack, so nothing about the page moves when the first word lands.
function FromYourFilms() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clapperboard className="w-4 h-4 text-orange-300" />
        <h2 className="text-sm font-semibold text-white">From your films</h2>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <Film className="w-9 h-9 text-zinc-600 mx-auto mb-2" />
        <p className="font-medium text-white">No words from a film yet</p>
        <p className="text-sm text-zinc-500 mt-1 mb-5 max-w-md mx-auto">
          Turn subtitles on and tap any word you don't know. Each one is filed under the film it
          came from, so you can study a title's words together.
        </p>
        <Link to="/browse" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          Find something to watch
        </Link>
      </div>
    </div>
  );
}

export default function MyLearningPage() {
  const stats = useWordStatsQuery();
  const [studying, setStudying] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Stats cover the whole vocabulary; this page only shows the personal list —
  // words saved while watching, not the imported starter packs.
  const all = useMemo(() => (stats.data ?? []).filter((w) => !w.list), [stats.data]);
  const addedCount = useMemo(() => all.filter((w) => !w.completedAt).length, [all]);
  const completedCount = useMemo(() => all.filter((w) => w.completedAt).length, [all]);
  const streak = useMemo(() => computeStreak(all), [all]);
  const dueCount = useDueCount();


  return (
    <div className="relative min-h-screen bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      <PageGradient className="from-emerald-950/40" />
      {/* Positioned so the content paints above the wash. */}
      <div className="relative mx-auto max-w-3xl">
        {stats.isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : all.length === 0 ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-transparent p-10 text-center">
              <div className="text-6xl mb-3 select-none">🌱</div>
              <p className="font-bold text-white text-lg">Your garden is empty</p>
              <p className="text-sm text-emerald-100/60 mt-1">Start with a pack, or collect words from a film — both below.</p>
            </div>
            <StarterPack />
            <FromYourFilms />
          </div>
        ) : (
          <div className="space-y-6">
            <LearningHero
              title="My Learning"
              subtitle="Study and review the words you saved — until they stick."
              addedCount={addedCount}
              streak={streak}
              dueCount={dueCount}
              onStudy={() => setStudying(true)}
              onReview={() => setReviewing(true)}
              insightsTo="/my-learning/insights"
              testsTo="/my-learning/test-results"
            />

            <StarterPack />

            <WordCollection addedCount={addedCount} completedCount={completedCount} />
          </div>
        )}
      </div>

      <StudySession total={addedCount} open={studying} onClose={() => setStudying(false)} />

      <AnimatePresence>
        {reviewing && <ReviewDeck onClose={() => setReviewing(false)} />}
      </AnimatePresence>
    </div>
  );
}
