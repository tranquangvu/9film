import { Link } from 'react-router-dom';
import { BarChart3, Brain, ClipboardList, Flame, GraduationCap } from 'lucide-react';
import { SECTION_SIZE } from '@/components/system/learn/section-break';

// One shared pill style for every hero action, so the four buttons match in
// shape, size, spacing, and hover. Review (and Study when nothing is due) use the
// primary variant; the rest are neutral. All hover via the same bg transition.
const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors';
const PILL_NEUTRAL = 'border-white/15 bg-white/5 text-white hover:bg-white/10';
const PILL_PRIMARY =
  'border-orange-400/40 bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600';

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
  // Studying/reviewing runs in sections of SECTION_SIZE, so when there are more
  // words than one section the button advertises the batch size (10), not the
  // full backlog — otherwise "Study 14 words" misleads about the session length.
  const studyCount = Math.min(addedCount, SECTION_SIZE);
  const reviewCount = Math.min(dueCount, SECTION_SIZE);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6 md:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{title}</h1>
        <p className="text-sm text-emerald-100/70">{subtitle}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {onReview && dueCount > 0 && (
          <button type="button" onClick={onReview} className={`${PILL} ${PILL_PRIMARY}`}>
            <Brain className="w-4 h-4" /> Review {reviewCount} {reviewCount === 1 ? 'word' : 'words'}
          </button>
        )}
        {addedCount > 0 && (
          <button
            type="button"
            onClick={onStudy}
            className={`${PILL} ${dueCount > 0 ? PILL_NEUTRAL : PILL_PRIMARY}`}
          >
            <GraduationCap className="w-4 h-4" /> Study {studyCount} {studyCount === 1 ? 'word' : 'words'}
          </button>
        )}
        <Link to={testsTo} className={`${PILL} ${PILL_NEUTRAL}`}>
          <ClipboardList className="w-4 h-4" /> Test results
        </Link>
        {insightsTo && (
          <Link to={insightsTo} className={`${PILL} ${PILL_NEUTRAL}`}>
            <BarChart3 className="w-4 h-4" /> Insights
          </Link>
        )}
        {streak > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
            <Flame className="w-4 h-4 text-orange-400" /> {streak}-day streak
          </span>
        )}
      </div>
    </div>
  );
}
