import { Link } from 'react-router-dom';
import { ChevronRight, Leaf } from 'lucide-react';

// Promo card on the personal page that links to the dedicated Oxford 3000 page.
export function StarterPack() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Leaf className="w-4 h-4 text-emerald-300" />
        <h2 className="text-sm font-semibold text-white">Starter packs</h2>
      </div>
      <Link
        to="/my-learning/the-oxford-3000"
        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:border-emerald-400/30 transition-colors"
      >
        <div className="text-4xl select-none">📚</div>
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-white">The Oxford 3000</p>
          <p className="text-sm text-zinc-400">The most important English words to know — open to add &amp; study them.</p>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
      </Link>
    </div>
  );
}
