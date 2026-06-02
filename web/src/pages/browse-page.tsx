import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { genres, genreName } from '@/data/genres';
import { MovieCard } from '@/components/system/movie/movie-card';
import { Empty } from '@/components/system/common/empty';
import { MovieGridSkeleton } from '@/components/system/movie/skeletons';
import { useBrowseTitleQuery } from '@/hooks/queries/use-browse-title-query';
import { cn } from '@/utils/cn';
import { toMovies } from '@/utils/title';
import { Tag } from '@/components/ui/tag';
import { buttonVariants } from '@/components/ui/button';

type ContentType = 'movie' | 'series'

const TYPE_OPTIONS: { id: ContentType; label: string; icon: string }[] = [
  { id: 'movie', label: 'Movies', icon: '🎬' },
  { id: 'series', label: 'TV Series', icon: '📺' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const genreParam = searchParams.get('genre');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(
    genreParam && genres.some((g) => g.id === genreParam) ? new Set([genreParam]) : new Set()
  );

  const toggleContentType = (type: ContentType) => {
    setContentType((prev) => (prev === type ? null : type));
    setSearchParams({});
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setSearchParams({});
  };

  const clearContentType = () => setContentType(null);

  const clearGenres = () => {
    setSelectedGenres(new Set());
    setSearchParams({});
  };

  const clearAll = () => {
    setContentType(null);
    setSelectedGenres(new Set());
    setSearchParams({});
  };

  const browseType = contentType === 'movie' ? 'movie' : contentType === 'series' ? 'tvseries' : undefined;
  const primaryGenre = selectedGenres.size === 1 ? genreName([...selectedGenres][0]) : undefined;
  const browse = useBrowseTitleQuery({ type: browseType, genre: primaryGenre, first: 50 });

  const filtered = useMemo(() => {
    let result = toMovies(browse.data?.titles ?? []);

    if (contentType) {
      result = result.filter((m) => m.type === contentType);
    }

    if (selectedGenres.size > 1) {
      const names = [...selectedGenres].map((id) => genreName(id).toLowerCase());
      result = result.filter((m) => m.genres.some((g) => names.includes(g.toLowerCase())));
    }

    return result;
  }, [browse.data, contentType, selectedGenres]);

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Page header */}
      <div className="pt-24 pb-6 px-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white">Browse</h1>
          <p className="text-zinc-500 mt-1 text-sm">Discover your next favorite film</p>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-4 md:px-8 lg:px-12 py-3 space-y-3">
        {/* Row 1 — content type */}
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_OPTIONS.map((type) => {
            const active = contentType === type.id;
            return (
              <Tag
                key={type.id}
                active={active}
                onClick={() => toggleContentType(type.id)}
              >
                <span className="text-base leading-none">{type.icon}</span>
                {type.label}
              </Tag>
            );
          })}

          <AnimatePresence>
            {contentType !== null && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearContentType}
                aria-label="Clear type filter"
                className={cn(buttonVariants({ variant: 'destructive', size: 'icon-sm' }), 'w-7 h-7 bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300')}
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Row 2 — genres */}
        <div className="flex items-center gap-2 flex-wrap">
          {genres.map((g) => {
            const active = selectedGenres.has(g.id);
            return (
              <Tag
                key={g.id}
                active={false}
                onClick={() => toggleGenre(g.id)}
                className={active ? 'border-transparent' : undefined}
                style={active ? { background: `${g.color}22`, borderColor: `${g.color}66`, color: g.color } : undefined}
              >
                <span className="text-base leading-none">{g.icon}</span>
                {g.name}
              </Tag>
            );
          })}

          <AnimatePresence>
            {selectedGenres.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearGenres}
                aria-label="Clear genre filters"
                className={cn(buttonVariants({ variant: 'destructive', size: 'icon-sm' }), 'w-7 h-7 bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300')}
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 lg:px-12 mt-6">
        <AnimatePresence mode="wait">
          {browse.isLoading ? (
            <MovieGridSkeleton />
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Empty
                icon="🔍"
                title="No titles found"
                message="Try selecting different genres."
                actionLabel="Clear Filters"
                onAction={clearAll}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`grid-${contentType ?? 'all'}-${[...selectedGenres].join('-')}`}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8"
            >
              {filtered.map((movie) => (
                <motion.div key={movie.id} variants={itemVariants}>
                  <MovieCard movie={movie} size="lg" className="w-full" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
