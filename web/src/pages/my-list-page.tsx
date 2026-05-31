import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderHeart, BookmarkCheck, Clock, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Movie } from '@/types';
import { myList, continueWatching, movies } from '@/data/movies';
import { MovieCard } from '@/components/system/movie/movie-card';
import { HorizontalCarousel } from '@/components/system/movie/movie-carousel';
import { Empty } from '@/components/system/common/empty';
import { Tag } from '@/components/ui/tag';

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

interface Collection {
  id: string
  name: string
  count: number
  posters: string[]
  color: string
}

const mockCollections: Collection[] = [
  {
    id: 'action',
    name: 'Action Night',
    count: 8,
    posters: [movies[1].poster, movies[5].poster, movies[7].poster],
    color: 'from-red-900/60 to-orange-900/40',
  },
  {
    id: 'weekend',
    name: 'Weekend Vibes',
    count: 5,
    posters: [movies[2].poster, movies[11].poster, movies[12].poster],
    color: 'from-purple-900/60 to-pink-900/40',
  },
  {
    id: 'mustwatch',
    name: 'Must Watch',
    count: 12,
    posters: [movies[0].poster, movies[3].poster, movies[4].poster],
    color: 'from-blue-900/60 to-cyan-900/40',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

interface RemovableCardProps {
  movie: Movie
  onRemove: (id: number) => void
}

function RemovableCard({ movie, onRemove }: RemovableCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      variants={itemVariants}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MovieCard movie={movie} size="lg" className="w-full" />

      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/70 border border-zinc-600 hover:bg-red-600 hover:border-red-500 flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(movie.id);
            }}
            aria-label="Remove from list"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.22, ease: 'easeOut' as const }}
      className="relative cursor-pointer rounded-xl overflow-hidden bg-surface border border-white/10 hover:border-white/20 transition-colors"
    >
      <div className={cn('relative h-32 bg-linear-to-br', collection.color, 'overflow-hidden')}>
        {collection.posters.map((poster, i) => (
          <img
            key={i}
            src={poster}
            alt=""
            className={cn(
              'absolute top-0 h-full object-cover rounded-lg shadow-xl transition-transform',
              i === 0 && 'left-2 w-[45%] z-10 -rotate-6 translate-y-2',
              i === 1 && 'left-[30%] w-[45%] z-20 rotate-0',
              i === 2 && 'right-2 w-[45%] z-10 rotate-6 translate-y-2',
            )}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ))}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent z-30" />
      </div>

      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-white">{collection.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{collection.count} titles</p>
      </div>
    </motion.div>
  );
}

const emptyMessages: Record<TabId, { title: string; message: string }> = {
  all: { title: 'Your list is empty', message: 'Start adding movies and shows to see them here.' },
  saved: { title: 'Nothing saved yet', message: 'Browse movies and shows, then save your favorites here.' },
  watchlater: { title: 'Nothing to watch later', message: 'Add titles to your Watch Later queue.' },
  continue: { title: 'Nothing in progress', message: 'Start watching something to see it here.' },
};

export default function MyListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [listItems, setListItems] = useState<Movie[]>(myList);

  const handleRemove = (id: number) => {
    setListItems((prev) => prev.filter((m) => m.id !== id));
  };

  const visibleMovies = listItems.filter((m) => {
    if (activeTab === 'watchlater') return !m.progress;
    return true;
  });

  const showContinueWatching = activeTab === 'all' || activeTab === 'continue';
  const showGrid = activeTab !== 'continue';
  const showCollections = activeTab === 'all';

  const sectionTitle =
    activeTab === 'watchlater' ? 'Watch Later' : 'Saved Titles';

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Page header */}
      <div className="pt-24 pb-6 px-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white">My List</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {listItems.length} title{listItems.length !== 1 ? 's' : ''} saved
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
      <AnimatePresence mode="wait">
        {showContinueWatching && continueWatching.length > 0 && (
          <motion.div
            key="continue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
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

      {/* Saved grid */}
      {showGrid && (
        <div className="px-4 md:px-8 lg:px-12 mt-6">
          {visibleMovies.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-5">{sectionTitle}</h2>
              <motion.div
                key={activeTab}
                layout
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8"
              >
                <AnimatePresence>
                  {visibleMovies.map((movie) => (
                    <RemovableCard key={movie.id} movie={movie} onRemove={handleRemove} />
                  ))}
                </AnimatePresence>
              </motion.div>
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

      {/* Collections */}
      {showCollections && (
        <div className="px-4 md:px-8 lg:px-12 mt-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">My Collections</h2>
            <button className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors">
              + New Collection
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
            {mockCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
