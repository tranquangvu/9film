import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, FolderHeart, BookmarkCheck, Play, Loader2 } from 'lucide-react';
import type { Movie } from '@/types';
import { useTitlesQuery } from '@/hooks/queries/use-titles-query';
import { useFavorites, useToggleListItem } from '@/hooks/queries/use-list-query';
import { useProgressQuery, progressPercent } from '@/hooks/queries/use-progress-query';
import { MovieCard } from '@/components/system/movie/movie-card';
import { ContinueWatchingCard } from '@/components/system/movie/continue-card';
import { HorizontalCarousel } from '@/components/system/movie/movie-carousel';
import { CarouselSkeleton, MovieGridSkeleton } from '@/components/system/movie/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/system/common/empty';
import { Tag } from '@/components/ui/tag';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

type TabId = 'all' | 'saved' | 'continue'

const TAB_IDS: TabId[] = ['all', 'saved', 'continue'];
const isTabId = (v: string | null): v is TabId => v !== null && (TAB_IDS as string[]).includes(v);

// Continue Watching shows at most this many in the carousel; the rest live in
// the "View all" drawer, which pages them in as you scroll.
const CONTINUE_CAROUSEL_MAX = 20;
const CONTINUE_DRAWER_PAGE = 20;
// Favorites grid loads this many titles at a time as you scroll.
const FAVORITES_PAGE = 20;

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'all', label: 'All', icon: <FolderHeart className="w-3.5 h-3.5" /> },
  { id: 'saved', label: 'Favorites', icon: <BookmarkCheck className="w-3.5 h-3.5" /> },
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
  continue: { title: 'Nothing in progress', message: 'Start watching something to see it here.' },
};

export default function MyListPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'all';
  const setActiveTab = (tab: TabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'all') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };
  const [continueDrawerOpen, setContinueDrawerOpen] = useState(false);
  const [continueVisible, setContinueVisible] = useState(CONTINUE_DRAWER_PAGE);
  const [favVisible, setFavVisible] = useState(FAVORITES_PAGE);

  // Server-backed favorites, hydrated into Movie objects via the IMDb queries.
  const favoritesQ = useFavorites();
  const progressQ = useProgressQuery();

  // Infinite scroll: only hydrate the first favVisible favorite ids; more are
  // fetched as the user scrolls near the bottom (each id is its own request).
  const favIds = useMemo(() => (favoritesQ.data ?? []).map((i) => i.imdbId), [favoritesQ.data]);
  const favTitles = useTitlesQuery(favIds.slice(0, favVisible));

  // Progress is per-episode, so a series has several rows. Collapse to one card
  // per title, keeping the most-recent row (the list is ordered newest-first).
  const progressItems = useMemo(() => {
    const seen = new Set<string>();
    return (progressQ.data ?? []).filter((p) => {
      if (seen.has(p.imdbId)) return false;
      seen.add(p.imdbId);
      return true;
    });
  }, [progressQ.data]);
  const continueTitles = useTitlesQuery(progressItems.map((p) => p.imdbId));
  const continueWatching = useMemo(
    () =>
      continueTitles.data.map((movie) => {
        const p = progressItems.find((x) => x.imdbId === movie.id);
        if (!p) return movie;
        return {
          ...movie,
          progress: progressPercent(p),
          resumeSeason: p.season > 0 ? p.season : undefined,
          resumeEpisode: p.season > 0 ? p.episode : undefined,
        };
      }),
    [continueTitles.data, progressItems],
  );

  const toggleFavorite = useToggleListItem();

  const hasError =
    favoritesQ.isError || progressQ.isError ||
    favTitles.isError || continueTitles.isError;

  useEffect(() => {
    if (hasError) {
      toast({
        title: 'Failed to load content',
        description: 'Could not load your list. Please try again.',
        variant: 'destructive',
      });
    }
  }, [hasError, toast]);

  // The grid shows favorites (All / Favorites tabs).
  const gridMovies = favTitles.data;
  // Full-grid skeleton only on the first load; later pages get a bottom spinner.
  const gridInitialLoading =
    favoritesQ.isLoading || (favTitles.loading && gridMovies.length === 0);
  const favHasMore = favVisible < favIds.length;
  const favLoadingMore = favHasMore && favTitles.loading && gridMovies.length > 0;

  const handleRemove = (movie: Movie) => {
    toggleFavorite.mutate({ imdbId: movie.id, mediaType: movie.type, active: true });
  };

  const showContinueWatching = activeTab === 'all' || activeTab === 'continue';
  const showGrid = activeTab !== 'continue';
  const continueLoading = progressQ.isLoading || continueTitles.loading;

  // Reveal more favorites as the window nears the bottom.
  useEffect(() => {
    if (!showGrid || !favHasMore) return;
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 600;
      if (nearBottom) setFavVisible((n) => Math.min(n + FAVORITES_PAGE, favIds.length));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // top up if the page is shorter than the viewport
    return () => window.removeEventListener('scroll', onScroll);
  }, [showGrid, favHasMore, favVisible, favIds.length]);

  const continueHasOverflow = continueWatching.length > CONTINUE_CAROUSEL_MAX;
  const openContinueDrawer = () => {
    setContinueVisible(CONTINUE_DRAWER_PAGE);
    setContinueDrawerOpen(true);
  };
  const onContinueDrawerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
      setContinueVisible((n) => Math.min(n + CONTINUE_DRAWER_PAGE, continueWatching.length));
    }
  };

  const savedCount = favIds.length;

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
      {showContinueWatching && !continueLoading && continueWatching.length > 0 && (
        <div className="mt-6">
          <HorizontalCarousel
            title="Continue Watching"
            movies={continueWatching.slice(0, CONTINUE_CAROUSEL_MAX)}
            cardType="backdrop"
            showSeeAll={continueHasOverflow}
            onViewAll={openContinueDrawer}
          />
        </div>
      )}

      {/* Favorites grid */}
      {showGrid && (
        <div className="px-4 md:px-8 lg:px-12 mt-6">
          {gridInitialLoading ? (
            <>
              <Skeleton className="h-6 w-40 mb-5" />
              <MovieGridSkeleton />
            </>
          ) : gridMovies.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-5">Favorites</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
                {gridMovies.map((movie) => (
                  <RemovableCard key={movie.id} movie={movie} onRemove={handleRemove} />
                ))}
              </div>
              {favLoadingMore && (
                <div className="flex justify-center mt-8 text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
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

      {/* View-all drawer — full Continue Watching list, paged in on scroll */}
      <Drawer open={continueDrawerOpen} onOpenChange={setContinueDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex items-center gap-2">
              <Play size={18} className="text-orange-500" />
              <DrawerTitle>Continue Watching</DrawerTitle>
            </div>
            <DrawerClose asChild>
              <button
                aria-label="Close"
                className={cn(
                  buttonVariants({ variant: 'ghost' }),
                  'p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 border-0 bg-transparent shadow-none',
                )}
              >
                <X size={18} />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div
            className="flex-1 overflow-y-auto px-5 pb-5 space-y-4"
            onScroll={onContinueDrawerScroll}
          >
            {continueWatching.slice(0, continueVisible).map((movie) => (
              <ContinueWatchingCard key={movie.id} movie={movie} className="w-full" />
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
