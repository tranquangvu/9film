import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  Check,
  XCircle,
  Trophy,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { useTestsQuery } from '@/hooks/queries/use-tests-query';
import { wordColor } from '@/utils/word-color';
import { parseDate } from '@/utils/word-date';
import { cn } from '@/utils/cn';
import type { TestResult, TestItem } from '@/services/user';

function when(s?: string): string {
  const d = parseDate(s);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TestResultsPage() {
  const { isAuthenticated } = useAuth();
  const { data: tests, isLoading } = useTestsQuery();
  const [open, setOpen] = useState<number | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 text-center text-zinc-400">
        <p>
          Please <Link to="/login" className="text-orange-400">sign in</Link> to view your test results.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-indigo-950/40 via-background to-background pt-24 pb-16 px-4 md:px-8 lg:px-12"
      style={{
        backgroundImage:
          'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="mx-auto max-w-3xl">
        <Link to="/my-learning" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-4">
          <ChevronLeft className="w-4 h-4" /> My Learning
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl select-none">📋</div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Test results</h1>
            <p className="text-sm text-indigo-100/70">Your spelling &amp; meaning self-tests.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : !tests || tests.length === 0 ? (
          <div className="rounded-3xl border border-indigo-400/15 bg-gradient-to-br from-indigo-500/10 to-transparent p-10 text-center">
            <ClipboardList className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
            <p className="font-bold text-white text-lg">No tests yet</p>
            <p className="text-sm text-indigo-100/60 mt-1">
              Open the <span className="text-white">Learned</span> tab and press <span className="text-white">Test</span> on a day to start one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map((t) => (
              <ResultCard key={t.id} test={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ test, open, onToggle }: { test: TestResult; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">
            {test.groupLabel || 'Word test'}
          </p>
          <p className="text-xs text-zinc-500">{when(test.createdAt)} · {test.total} {test.total === 1 ? 'word' : 'words'}</p>
        </div>
        <ScoreChip icon={<Trophy className="w-3.5 h-3.5" />} value={test.spellingCorrect} total={test.total} />
        <ScoreChip icon={<CheckCircle2 className="w-3.5 h-3.5" />} value={test.meaningCorrect} total={test.total} />
        <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
              {test.items.map((it) => (
                <ItemRow key={it.word} item={it} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreChip({ icon, value, total }: { icon: React.ReactNode; value: number; total: number }) {
  const good = total > 0 && value === total;
  return (
    <span
      className={cn(
        'hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0',
        good ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25' : 'bg-white/5 text-zinc-300 border border-white/10',
      )}
    >
      {icon} {value}/{total}
    </span>
  );
}

function ItemRow({ item }: { item: TestItem }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold capitalize" style={{ color: wordColor(item.word).color }}>
          {item.word}
        </span>
        <Badge variant="tag" className={cn(item.spellingScore === item.spellings.length ? 'text-emerald-300' : 'text-zinc-400')}>
          {item.spellingScore}/{item.spellings.length} spelt
        </Badge>
        {/* The spelling attempts, each flagged right/wrong. */}
        <span className="flex items-center gap-1.5">
          {item.spellings.map((s, i) => {
            const ok = s.trim().toLowerCase() === item.word.toLowerCase();
            return (
              <span
                key={i}
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-md',
                  ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300 line-through',
                )}
              >
                {s.trim() || '—'}
              </span>
            );
          })}
        </span>
      </div>

      <div className="mt-2 flex items-start gap-2">
        {item.meaningCorrect ? (
          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">
            <span className="text-zinc-500">Your meaning: </span>
            {item.meaning || <span className="italic text-zinc-600">(blank)</span>}
          </p>
          {item.feedback && <p className="text-xs text-zinc-400 mt-0.5">{item.feedback}</p>}
        </div>
      </div>
    </div>
  );
}
