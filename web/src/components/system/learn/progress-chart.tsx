import { Fragment, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDate } from '@/utils/word-date';
import type { WordStat } from '@/services/user';

const TO_LEARN_COLOR = '#34d399'; // emerald-400
const COMPLETED_COLOR = '#fb923c'; // orange-400

// A month-at-a-time line chart of words added vs. completed per day.
export function ProgressChart({ words }: { words: WordStat[] }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const { added, completed, daysInMonth } = useMemo(() => {
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const a = new Array(days).fill(0);
    const c = new Array(days).fill(0);
    for (const w of words) {
      const cr = parseDate(w.createdAt);
      if (cr && cr.getFullYear() === view.year && cr.getMonth() === view.month) a[cr.getDate() - 1]++;
      const cp = parseDate(w.completedAt);
      if (cp && cp.getFullYear() === view.year && cp.getMonth() === view.month) c[cp.getDate() - 1]++;
    }
    return { added: a, completed: c, daysInMonth: days };
  }, [words, view]);

  const max = Math.max(1, ...added, ...completed);
  const xAt = (i: number) => (daysInMonth <= 1 ? 50 : (i / (daysInMonth - 1)) * 100);
  const yAt = (v: number) => 95 - (v / max) * 90;
  const points = (series: number[]) => series.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white">{monthLabel}</span>
        <button
          onClick={() => step(1)}
          disabled={isCurrentMonth}
          aria-label="Next month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="relative h-28">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {added.map((_, i) => (
            <line
              key={i}
              x1={xAt(i)}
              y1={0}
              x2={xAt(i)}
              y2={100}
              stroke="#ffffff"
              strokeOpacity={0.06}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline points={points(added)} fill="none" stroke={TO_LEARN_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <polyline points={points(completed)} fill="none" stroke={COMPLETED_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {added.map((v, i) => (
          <Fragment key={i}>
            {v > 0 && (
              <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${xAt(i)}%`, top: `${yAt(v)}%`, background: TO_LEARN_COLOR }} />
            )}
            {completed[i] > 0 && (
              <span className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${xAt(i)}%`, top: `${yAt(completed[i])}%`, background: COMPLETED_COLOR }} />
            )}
          </Fragment>
        ))}
      </div>

      <div className="relative mt-1 h-4">
        {added.map((_, i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-500" style={{ left: `${xAt(i)}%` }}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TO_LEARN_COLOR }} /> Added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COMPLETED_COLOR }} /> Completed
        </span>
      </div>
    </div>
  );
}
