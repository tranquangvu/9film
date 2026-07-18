import { Fragment, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseDate } from '@/utils/word';

// Fixed hue order — a series keeps its colour whatever else is on the chart.
export const NEW_WORDS_COLOR = '#34d399'; // emerald-400
export const COMPLETED_COLOR = '#fb923c'; // orange-400
export const TESTS_COLOR = '#818cf8'; // indigo-400

export interface ChartSeries {
  label: string;
  color: string;
  // One timestamp per event; the chart buckets them into days itself. Undefined
  // entries (e.g. a word never completed) are skipped.
  dates: (string | undefined)[];
}

// A month-at-a-time line chart: one line per series, counting events per day.
export function ProgressChart({ title, series }: { title?: string; series: ChartSeries[] }) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  // Day index under the pointer (or the keyboard cursor); null when not hovering.
  const [hover, setHover] = useState<number | null>(null);

  const { counts, daysInMonth } = useMemo(() => {
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const bySeries = series.map((s) => {
      const bucket: number[] = new Array(days).fill(0);
      for (const date of s.dates) {
        const d = parseDate(date);
        if (d && d.getFullYear() === view.year && d.getMonth() === view.month) bucket[d.getDate() - 1]++;
      }
      return bucket;
    });
    return { counts: bySeries, daysInMonth: days };
  }, [series, view]);

  const max = Math.max(1, ...counts.flat());
  const xAt = (i: number) => (daysInMonth <= 1 ? 50 : (i / (daysInMonth - 1)) * 100);
  const yAt = (v: number) => 95 - (v / max) * 90;
  const points = (values: number[]) => values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const clampDay = (i: number) => Math.min(daysInMonth - 1, Math.max(0, i));
  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      {title && <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>}
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

      {/* The plot doubles as the hover surface: the pointer only has to be nearest
          a day, never on a 2px line, and arrow keys walk the same readout. */}
      <div
        className="relative h-28 outline-none"
        tabIndex={0}
        role="application"
        aria-label={`${title ?? 'Daily activity'} for ${monthLabel}. Use arrow keys to read each day.`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - box.left) / box.width;
          setHover(clampDay(Math.round(ratio * (daysInMonth - 1))));
        }}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setHover((h) => clampDay((h ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)));
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {hover !== null && (
            <line
              x1={xAt(hover)}
              y1={0}
              x2={xAt(hover)}
              y2={100}
              stroke="#ffffff"
              strokeOpacity={0.35}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {Array.from({ length: daysInMonth }, (_, i) => (
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
          {counts.map((values, s) => (
            <polyline
              key={series[s].label}
              points={points(values)}
              fill="none"
              stroke={series[s].color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {counts.map((values, s) => (
          <Fragment key={series[s].label}>
            {values.map((v, i) =>
              // The hovered day always shows its markers, so a zero still reads.
              v > 0 || hover === i ? (
                <Dot key={i} x={xAt(i)} y={yAt(v)} color={series[s].color} on={hover === i} />
              ) : null,
            )}
          </Fragment>
        ))}
        {hover !== null && (
          <Tooltip
            x={xAt(hover)}
            label={new Date(view.year, view.month, hover + 1).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
            rows={series.map((s, i) => ({ color: s.color, label: s.label, value: counts[i][hover] }))}
          />
        )}
      </div>

      <div className="relative mt-1 h-4">
        {Array.from({ length: daysInMonth }, (_, i) => (
          <span
            key={i}
            className={`absolute -translate-x-1/2 whitespace-nowrap text-[10px] ${hover === i ? 'font-semibold text-white' : 'text-zinc-500'}`}
            style={{ left: `${xAt(i)}%` }}
          >
            {i + 1}
          </span>
        ))}
      </div>

      {/* A single series needs no legend — the card title already names it. */}
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-400">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// A data point. The hovered pair grows and gets a surface ring so it reads as
// the selection even where the two lines cross.
function Dot({ x, y, color, on }: { x: number; y: number; color: string; on: boolean }) {
  return (
    <span
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${on ? 'h-2.5 w-2.5 ring-2 ring-background' : 'h-1.5 w-1.5'}`}
      style={{ left: `${x}%`, top: `${y}%`, background: color }}
    />
  );
}

// The hover readout: the day, then every series at that day — value first (it's
// what the reader came for), series name second, identity carried by a short
// stroke of the line's colour rather than by the text colour.
function Tooltip({
  x,
  label,
  rows,
}: {
  x: number;
  label: string;
  rows: { color: string; label: string; value: number }[];
}) {
  // Keep the box inside the plot at the edges instead of letting it clip.
  const anchor = x < 20 ? '0' : x > 80 ? '-100%' : '-50%';
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-max rounded-xl border border-white/10 bg-surface/95 px-2.5 py-2 shadow-xl backdrop-blur-sm"
      style={{ left: `${x}%`, top: 0, transform: `translate(${anchor}, calc(-100% - 8px))` }}
      role="status"
    >
      <p className="mb-1 text-[10px] font-medium text-zinc-400">{label}</p>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <p key={r.label} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />
            <span className="font-semibold tabular-nums text-white">{r.value}</span>
            {r.label}
          </p>
        ))}
      </div>
    </div>
  );
}
