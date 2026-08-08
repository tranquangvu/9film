import { Link } from 'react-router-dom';
import { BarChart3, Brain, ClipboardList, Flame, GraduationCap } from 'lucide-react';
import { LearningGuide } from '@/components/system/learn/learning-guide';

// One shared pill style for every hero action — same shape, size, spacing and
// hover across all four, none of them singled out. With no orange button left in
// the row, the streak badge is the card's only warm accent, which is what keeps
// it reading as a stat rather than a fifth action.
const PILL =
  'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10';

export function LearningHero({
  title,
  subtitle,
  addedCount,
  streak,
  dueCount,
  onStudy,
  onReview,
  insightsTo,
  testsTo,
}: {
  title: string;
  subtitle: string;
  addedCount: number;
  streak: number;
  dueCount: number;
  onStudy: () => void;
  onReview?: () => void;
  insightsTo?: string;
  testsTo: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 md:p-8">
      {/* Help sits in the card's top corner, not beside the title: inline it
          rides the heading's baseline and reads as part of the name, and it
          shoves the title around on narrow screens. The corner is also where the
          streak badge used to be, so nothing is wasted. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-emerald-100/70">{subtitle}</p>
        </div>
        <LearningGuide />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {addedCount > 0 && (
          <button type="button" onClick={onStudy} className={PILL}>
            <GraduationCap className="w-4 h-4" /> Study
          </button>
        )}
        {onReview && dueCount > 0 && (
          <button type="button" onClick={onReview} className={PILL}>
            <Brain className="w-4 h-4" /> Review
          </button>
        )}
        <Link to={testsTo} className={PILL}>
          <ClipboardList className="w-4 h-4" /> Test results
        </Link>
        {insightsTo && (
          <Link to={insightsTo} className={PILL}>
            <BarChart3 className="w-4 h-4" /> Insights
          </Link>
        )}
        {/* Ends the action row rather than opening the card: actions read left to
            right, the stat closes them off on the right. Pill-shaped to sit on
            the row's baseline, but tinted and unclickable so it doesn't pass for
            a button — the mistake the old plain-text version made.
            The right-push is desktop-only: once the row wraps, `ml-auto` strands
            the badge at the far end of a half-empty second line with a gap in
            between, so on small screens it just flows after the last button. */}
        {streak > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-500/10 px-3.5 py-1.5 text-sm font-semibold text-orange-200 lg:ml-auto">
            <Flame className="w-4 h-4 text-orange-400" />
            {streak}-day streak
          </span>
        )}
      </div>
    </div>
  );
}
