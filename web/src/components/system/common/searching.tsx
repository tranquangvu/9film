import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Star, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchQuery } from '@/hooks/queries/use-search-query';
import { useBrowseTitleQuery } from '@/hooks/queries/use-browse-title-query';
import { toMovie } from '@/utils/title';
import { cn } from '@/utils/cn';
import { formatYear } from '@/utils/format';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const trendingSearches = [
  'Christopher Nolan',
  'Marvel',
  'Sci-Fi',
  'Denis Villeneuve',
  'Action Thriller',
  'Academy Award',
  'Tom Holland',
  'Animated',
];

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const search = useSearchQuery(query, 12);
  const trending = useBrowseTitleQuery({ sort: 'popular', first: 8 });

  const results = query.trim().length > 0
    ? (search.data ?? []).map(toMovie)
    : [];

  const popular = (trending.data?.titles ?? []).map(toMovie).slice(0, 4);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleClose]);

  const handleMovieClick = (imdbId: string) => {
    navigate(`/movie/${imdbId}`);
    handleClose();
  };

  const handleTrendingClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col"
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
            {/* Search input */}
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

            {/* Results */}
            {query.trim() ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Search size={13} className="text-zinc-600" />
                  <span className="text-sm text-zinc-500">
                    {results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''} for` : 'No results for'}
                    {' '}
                    <span className="text-white font-medium">"{query}"</span>
                  </span>
                </div>

                {results.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {results.map(movie => (
                      <motion.button
                        key={movie.id}
                        onClick={() => handleMovieClick(movie.id)}
                        className="group flex flex-col rounded-xl overflow-hidden text-left transition-all duration-200 hover:ring-2 hover:ring-orange-500/50"
                        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="aspect-[2/3] overflow-hidden bg-zinc-900">
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-white leading-tight line-clamp-2 mb-1">
                            {movie.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{formatYear(movie.year)}</span>
                            <div className="flex items-center gap-0.5">
                              <Star size={9} className="text-orange-500 fill-orange-500" />
                              <span className="text-xs text-zinc-400">{movie.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.button>
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
              /* Trending section */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-orange-500" />
                  <span className="text-sm font-semibold text-zinc-300">Recommended Searches</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-8">
                  {trendingSearches.map(term => (
                    <Tag
                      key={term}
                      active={false}
                      onClick={() => handleTrendingClick(term)}
                      className="px-3.5 py-1.5 text-zinc-300 hover:border-orange-500/50 font-normal"
                      style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {term}
                    </Tag>
                  ))}
                </div>

                {/* Recent movies preview */}
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} className="text-zinc-500" />
                  <span className="text-sm font-semibold text-zinc-300">Popular Right Now</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {popular.map(movie => (
                    <motion.button
                      key={movie.id}
                      onClick={() => handleMovieClick(movie.id)}
                      className="group flex flex-col rounded-xl overflow-hidden text-left"
                      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="aspect-[2/3] overflow-hidden bg-zinc-900">
                        <img
                          src={movie.poster}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-white leading-tight line-clamp-2 mb-1">
                          {movie.title}
                        </p>
                        <span className="text-xs text-zinc-500">{formatYear(movie.year)}</span>
                      </div>
                    </motion.button>
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
