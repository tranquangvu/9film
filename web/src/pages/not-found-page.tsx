import { Clapperboard, MoveLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <Clapperboard className="w-24 h-24 mb-6 text-orange-500" strokeWidth={1.5} />
      <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
      <p className="text-zinc-400 mb-8">The page you're looking for doesn't exist.</p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors"
      >
        <MoveLeft size={18} />
        Back to home
      </a>
    </div>
  );
}
