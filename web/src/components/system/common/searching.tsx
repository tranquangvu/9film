import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSearchQuery } from '@/hooks/queries/use-search-query';
import { useBrowseTitleQuery } from '@/hooks/queries/use-browse-title-query';
import { toMovie } from '@/utils/title';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MovieCard } from '@/components/system/movie/movie-card';
import { PosterTileSkeleton } from '@/components/system/movie/skeletons';

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const search = useSearchQuery(query, 12);
  const trending = useBrowseTitleQuery({ sort: 'popular', first: 8 });

  const results = query.trim().length > 0
    ? (search.data ?? []).map(toMovie)
    : [];

  const popular = (trending.data?.titles ?? []).map(toMovie).slice(0, 8);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Lock the page behind the overlay so scrolling stays inside the popup.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleClose]);

  // MovieCard navigates on click; close the overlay whenever the route changes.
  // Syncing the modal's open-state to the router is a deliberate state update.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto overscroll-contain"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(24px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-3xl mx-auto px-4 pt-20 pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 px-5 py-4 rounded-2xl mb-8"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Search size={20} className="text-zinc-500 flex-shrink-0" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search movies, shows, directors, actors..."
                className="flex-1 placeholder:text-zinc-600 text-lg"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className={cn(buttonVariants({ variant: 'ghost' }), 'p-1 text-zinc-500 hover:text-white border-0 bg-transparent hover:bg-transparent shadow-none')}
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={handleClose}
                className={cn(buttonVariants({ variant: 'ghost' }), 'ml-1 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border-0 bg-transparent shadow-none')}
              >
                <span className="text-xs font-mono border border-white/20 rounded px-1.5 py-0.5">ESC</span>
              </button>
            </div>

            {query.trim() ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Search size={13} className="text-zinc-600" />
                  <span className="text-sm text-zinc-500">
                    {search.isLoading
                      ? 'Searching'
                      : results.length > 0
                        ? `${results.length} result${results.length !== 1 ? 's' : ''} for`
                        : 'No results for'}
                    {' '}
                    <span className="text-white font-medium">"{query}"</span>
                  </span>
                </div>

                {search.isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <PosterTileSkeleton key={i} />
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {results.map(movie => (
                      <MovieCard key={movie.id} movie={movie} className="w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#1a1a1a' }}>
                      <Search size={24} className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-medium mb-1">No results found</p>
                    <p className="text-sm text-zinc-600">Try a different search term or browse genres</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-orange-500" />
                  <span className="text-sm font-semibold text-zinc-300">Popular Now</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {trending.isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <PosterTileSkeleton key={i} />)
                    : popular.map(movie => (
                      <MovieCard key={movie.id} movie={movie} className="w-full" />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
