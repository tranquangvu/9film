import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderHeart, BookmarkCheck, Clock, Play } from 'lucide-react';
import type { Movie } from '@/types';
import { useTitlesQuery } from '@/hooks/queries/use-titles-query';
import { useFavorites, useWatchlist, useToggleListItem } from '@/hooks/queries/use-list-query';
import { useProgressQuery, progressPercent } from '@/hooks/queries/use-progress-query';
import { MovieCard } from '@/components/system/movie/movie-card';
import { HorizontalCarousel } from '@/components/system/movie/movie-carousel';
import { CarouselSkeleton, MovieGridSkeleton } from '@/components/system/movie/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/system/common/empty';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';

type TabId = 'all' | 'saved' | 'watchlater' | 'continue'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'all', label: 'All', icon: <FolderHeart className="w-3.5 h-3.5" /> },
  { id: 'saved', label: 'Saved Titles', icon: <BookmarkCheck className="w-3.5 h-3.5" /> },
  { id: 'watchlater', label: 'Watch Later', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'continue', label: 'Continue Watching', icon: <Play className="w-3.5 h-3.5" /> },
];

interface RemovableCardProps {
  movie: Movie
  onRemove: (movie: Movie) => void
}

function RemovableCard({ movie, onRemove }: RemovableCardProps) {
  return (
    <div className="relative group/removable">
      <MovieCard movie={movie} size="lg" className="w-full" />

      <button
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/70 border border-zinc-600 hover:bg-red-600 hover:border-red-500 flex items-center justify-center transition-all opacity-0 scale-90 group-hover/removable:opacity-100 group-hover/removable:scale-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(movie);
        }}
        aria-label="Remove from list"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  );
}

const emptyMessages: Record<TabId, { title: string; message: string }> = {
  all: { title: 'Your list is empty', message: 'Start adding movies and shows to see them here.' },
  saved: { title: 'Nothing saved yet', message: 'Browse movies and shows, then tap the heart to save your favorites here.' },
  watchlater: { title: 'Nothing to watch later', message: 'Bookmark titles to build your Watch Later queue.' },
  continue: { title: 'Nothing in progress', message: 'Start watching something to see it here.' },
};

export default function MyListPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Server-backed id lists, hydrated into Movie objects via the IMDb queries.
  const favoritesQ = useFavorites();
  const watchlistQ = useWatchlist();
  const progressQ = useProgressQuery();

  const favTitles = useTitlesQuery((favoritesQ.data ?? []).map((i) => i.imdbId));
  const watchTitles = useTitlesQuery((watchlistQ.data ?? []).map((i) => i.imdbId));

  const progressItems = useMemo(() => progressQ.data ?? [], [progressQ.data]);
  const continueTitles = useTitlesQuery(progressItems.map((p) => p.imdbId));
  const continueWatching = useMemo(
    () =>
      continueTitles.data.map((movie) => {
        const p = progressItems.find((x) => x.imdbId === movie.id);
        return p ? { ...movie, progress: progressPercent(p) } : movie;
      }),
    [continueTitles.data, progressItems],
  );

  const toggleFavorite = useToggleListItem('favorite');
  const toggleWatchlist = useToggleListItem('watchlist');

  const hasError =
    favoritesQ.isError || watchlistQ.isError || progressQ.isError ||
    favTitles.isError || watchTitles.isError || continueTitles.isError;

  useEffect(() => {
    if (hasError) {
      toast({
        title: 'Failed to load content',
        description: 'Could not load your list. Please try again.',
        variant: 'destructive',
      });
    }
  }, [hasError, toast]);

  // The grid shows favorites for All/Saved, watchlist for Watch Later.
  const gridKind = activeTab === 'watchlater' ? 'watchlist' : 'favorite';
  const gridTitles = gridKind === 'watchlist' ? watchTitles : favTitles;
  const gridLoading = gridKind === 'watchlist'
    ? watchlistQ.isLoading || watchTitles.loading
    : favoritesQ.isLoading || favTitles.loading;
  const gridMovies = gridTitles.data;

  const handleRemove = (movie: Movie) => {
    const toggle = gridKind === 'watchlist' ? toggleWatchlist : toggleFavorite;
    toggle.mutate({ imdbId: movie.id, mediaType: movie.type, active: true });
  };

  const showContinueWatching = activeTab === 'all' || activeTab === 'continue';
  const showGrid = activeTab !== 'continue';
  const continueLoading = progressQ.isLoading || continueTitles.loading;

  const sectionTitle = activeTab === 'watchlater' ? 'Watch Later' : 'Saved Titles';
  const savedCount = favTitles.data.length;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Page header */}
      <div className="pt-24 pb-6 px-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white">My List</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {savedCount} title{savedCount !== 1 ? 's' : ''} saved
          </p>
        </motion.div>
      </div>

      {/* Tab filters */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-4 md:px-8 lg:px-12 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => (
            <Tag
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </Tag>
          ))}
        </div>
      </div>

      {/* Continue Watching */}
      {showContinueWatching && continueLoading && (
        <div className="mt-6">
          <CarouselSkeleton cardType="backdrop" count={4} />
        </div>
      )}
      <AnimatePresence mode="wait">
        {showContinueWatching && !continueLoading && continueWatching.length > 0 && (
          <motion.div
            key="continue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <HorizontalCarousel
              title="Continue Watching"
              movies={continueWatching}
              cardType="backdrop"
              showSeeAll={false}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved / Watch Later grid */}
      {showGrid && (
        <div className="px-4 md:px-8 lg:px-12 mt-6">
          {gridLoading ? (
            <>
              <Skeleton className="h-6 w-40 mb-5" />
              <MovieGridSkeleton />
            </>
          ) : gridMovies.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-5">{sectionTitle}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                {gridMovies.map((movie) => (
                  <RemovableCard key={movie.id} movie={movie} onRemove={handleRemove} />
                ))}
              </div>
            </>
          ) : (
            <Empty
              icon="📋"
              title={emptyMessages[activeTab].title}
              message={emptyMessages[activeTab].message}
              actionLabel="Browse Content"
              onAction={() => navigate('/browse')}
            />
          )}
        </div>
      )}
    </div>
  );
}
