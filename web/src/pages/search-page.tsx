import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Star, Clock, TrendingUp } from 'lucide-react';
import { useSearchQuery } from '@/hooks/queries/use-search-query';
import { useToast } from '@/components/ui/toast';
import { toMovie } from '@/utils/title';
import { Empty } from '@/components/system/common/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchResultsSkeleton } from '@/components/system/movie/skeletons';
import { cn } from '@/utils/cn';
import { formatYear, formatDuration, formatRating } from '@/utils/format';
import { Tag } from '@/components/ui/tag';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Movie } from '@/types';

const MotionTag = motion(Tag);

const TRENDING_TAGS = [
  'Christopher Nolan',
  'Marvel',
  'Sci-Fi 2024',
  'Award Winners',
  'Netflix Originals',
  'Korean Drama',
  'Anime',
  'Horror',
  'Action Thriller',
];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-orange-500/30 text-orange-300 rounded-sm px-0.5 not-italic font-semibold">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface SearchResultRowProps {
  movie: Movie
  query: string
}

function SearchResultRow({ movie, query }: SearchResultRowProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={() => navigate(`/movie/${movie.id}`)}
      className="flex gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors"
    >
      {/* Thumbnail */}
      <div className="shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-surface-2">
        {!imgError ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-zinc-600 text-xs text-center px-1">{movie.title}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 grow py-1">
        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-1">
          {highlightMatch(movie.title, query)}
        </h3>

        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
            <span className="text-orange-400 font-medium">{formatRating(movie.rating)}</span>
          </span>
          <span>·</span>
          <span>{formatYear(movie.year)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {movie.type === 'series'
              ? `${movie.totalSeasons ?? 1} Season${(movie.totalSeasons ?? 1) > 1 ? 's' : ''}`
              : formatDuration(movie.duration)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 mt-1.5">
          {movie.genres.slice(0, 3).map((g) => (
            <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-zinc-400 border border-white/8">
              {highlightMatch(g, query)}
            </span>
          ))}
        </div>

        <p className="text-zinc-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
          {highlightMatch(movie.description.slice(0, 120) + '…', query)}
        </p>
      </div>

      {/* Type badge */}
      <div className="shrink-0 self-start mt-1">
        <span
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
            movie.type === 'series'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
          )}
        >
          {movie.type === 'series' ? 'Series' : 'Film'}
        </span>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) setSearchParams({ q: value });
    else setSearchParams({});
  };

  const search = useSearchQuery(query, 30);

  useEffect(() => {
    if (search.isError) {
      toast({
        title: 'Failed to load content',
        description: 'Could not load search results. Please try again.',
        variant: 'destructive',
      });
    }
  }, [search.isError, toast]);

  const results = useMemo(() => {
    if (!query.trim()) return { films: [], series: [] };
    const matched = (search.data ?? []).map(toMovie);
    return {
      films: matched.filter((m) => m.type === 'movie'),
      series: matched.filter((m) => m.type === 'series'),
    };
  }, [query, search.data]);

  const totalCount = results.films.length + results.series.length;
  const isSearching = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="pt-24 px-4 md:px-8 lg:px-12 max-w-4xl mx-auto">
        {/* Search input */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search movies, shows, directors, actors…"
            className="pl-12 pr-12 py-4 bg-surface border border-white/10 rounded-2xl text-lg placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => handleQueryChange('')}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7')}
              >
                <X className="w-4 h-4 text-zinc-400" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {!isSearching ? (
            /* Recommended searches */
            <motion.div
              key="trending"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="mt-10"
            >
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
                  Recommended Searches
                </h2>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {TRENDING_TAGS.map((tag, i) => (
                  <MotionTag
                    key={tag}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    active={false}
                    onClick={() => handleQueryChange(tag)}
                    className="bg-surface-2 text-zinc-300 hover:border-orange-500/50 hover:bg-orange-500/10 px-4 py-2"
                  >
                    {tag}
                  </MotionTag>
                ))}
              </div>

              {/* Browse prompt */}
              <div className="mt-12 text-center">
                <p className="text-zinc-600 text-sm">
                  Looking for something specific? Start typing above.
                </p>
              </div>
            </motion.div>
          ) : search.isLoading || search.isError ? (
            /* Loading results */
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6 space-y-6"
            >
              <Skeleton className="h-4 w-40" />
              <SearchResultsSkeleton />
            </motion.div>
          ) : (
            /* Search results */
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-6"
            >
              {/* Result count */}
              <motion.p
                key={totalCount}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-zinc-500 text-sm mb-6"
              >
                {totalCount > 0 ? (
                  <>
                    Found{' '}
                    <span className="text-white font-semibold">{totalCount}</span>{' '}
                    {totalCount === 1 ? 'result' : 'results'} for{' '}
                    <span className="text-orange-400">"{query}"</span>
                  </>
                ) : (
                  <>
                    No results for <span className="text-orange-400">"{query}"</span>
                  </>
                )}
              </motion.p>

              {totalCount === 0 ? (
                <Empty
                  icon="🔭"
                  title="Nothing found"
                  message={`We couldn't find anything matching "${query}". Try a different keyword.`}
                  actionLabel="Clear Search"
                  onAction={() => handleQueryChange('')}
                />
              ) : (
                <div className="space-y-8">
                  {/* Movies section */}
                  {results.films.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-base font-bold text-white">Movies</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {results.films.length}
                        </span>
                      </div>
                      <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-white/5">
                        {results.films.map((movie) => (
                          <SearchResultRow key={movie.id} movie={movie} query={query} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* TV Series section */}
                  {results.series.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-base font-bold text-white">TV Series</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {results.series.length}
                        </span>
                      </div>
                      <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-white/5">
                        {results.series.map((movie) => (
                          <SearchResultRow key={movie.id} movie={movie} query={query} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
