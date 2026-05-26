import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderHeart, BookmarkCheck, Clock, Play, Film, Tv } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Movie } from '@/types'
import { myList, continueWatching, movies } from '@/data/movies'
import { MovieCard } from '@/components/movie/MovieCard'
import { HorizontalCarousel } from '@/components/movie/HorizontalCarousel'

// ---------------------------------------------------------------------------
// Types & Mock Data
// ---------------------------------------------------------------------------

type TabId = 'all' | 'movies' | 'shows' | 'watchlater' | 'continue'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'all', label: 'All', icon: <FolderHeart className="w-3.5 h-3.5" /> },
  { id: 'movies', label: 'Saved Movies', icon: <Film className="w-3.5 h-3.5" /> },
  { id: 'shows', label: 'Favorite Shows', icon: <Tv className="w-3.5 h-3.5" /> },
  { id: 'watchlater', label: 'Watch Later', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'continue', label: 'Continue Watching', icon: <Play className="w-3.5 h-3.5" /> },
]

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
]

// ---------------------------------------------------------------------------
// Remove overlay card wrapper
// ---------------------------------------------------------------------------

interface RemovableCardProps {
  movie: Movie
  onRemove: (id: number) => void
}

function RemovableCard({ movie, onRemove }: RemovableCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.25 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MovieCard movie={movie} />

      {/* Remove button — appears on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/70 border border-zinc-600 hover:bg-red-600 hover:border-red-500 flex items-center justify-center transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(movie.id)
            }}
            title="Remove from list"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Collection Card
// ---------------------------------------------------------------------------

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative cursor-pointer rounded-xl overflow-hidden bg-surface border border-zinc-800 hover:border-zinc-600 transition-colors"
    >
      {/* Stacked poster thumbnails */}
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
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ))}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent z-30" />
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-white">{collection.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{collection.count} titles</p>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ tab }: { tab: TabId }) {
  const messages: Record<TabId, { title: string; description: string }> = {
    all: { title: 'Your list is empty', description: 'Start adding movies and shows to see them here.' },
    movies: { title: 'No saved movies', description: 'Browse movies and save your favorites.' },
    shows: { title: 'No favorite shows', description: 'Follow your favorite series here.' },
    watchlater: { title: 'Nothing to watch later', description: 'Add titles to your Watch Later queue.' },
    continue: { title: 'Nothing in progress', description: 'Start watching something to see it here.' },
  }
  const { title, description } = messages[tab]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700 flex items-center justify-center mb-4">
        <BookmarkCheck className="w-8 h-8 text-zinc-500" />
      </div>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="text-sm text-zinc-500 mt-1 max-w-xs">{description}</p>
      <button className="mt-5 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold transition-colors">
        Browse Content
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// MyListPage
// ---------------------------------------------------------------------------

export default function MyListPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [listItems, setListItems] = useState<Movie[]>(myList)

  const handleRemove = (id: number) => {
    setListItems((prev) => prev.filter((m) => m.id !== id))
  }

  const visibleMovies = listItems.filter((m) => {
    if (activeTab === 'movies') return m.type === 'movie'
    if (activeTab === 'shows') return m.type === 'series'
    if (activeTab === 'watchlater') return !m.progress
    return true
  })

  const showContinueWatching = activeTab === 'all' || activeTab === 'continue'
  const showGrid = activeTab !== 'continue'
  const showCollections = activeTab === 'all'

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white tracking-tight">My List</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {listItems.length} title{listItems.length !== 1 ? 's' : ''} saved
          </p>
        </motion.div>

        {/* ── Tab Navigation ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-surface border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ── Continue Watching ── */}
        <AnimatePresence mode="wait">
          {showContinueWatching && continueWatching.length > 0 && (
            <motion.div
              key="continue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-10"
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

        {/* ── Saved Grid ── */}
        {showGrid && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {activeTab === 'movies'
                  ? 'Saved Movies'
                  : activeTab === 'shows'
                  ? 'Favorite Shows'
                  : activeTab === 'watchlater'
                  ? 'Watch Later'
                  : 'Saved Titles'}
              </h2>
              {visibleMovies.length > 0 && (
                <span className="text-xs text-zinc-500">{visibleMovies.length} items</span>
              )}
            </div>

            {visibleMovies.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              >
                <AnimatePresence>
                  {visibleMovies.map((movie) => (
                    <RemovableCard key={movie.id} movie={movie} onRemove={handleRemove} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <EmptyState tab={activeTab} />
            )}
          </div>
        )}

        {/* ── Custom Collections ── */}
        {showCollections && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">My Collections</h2>
              <button className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors">
                + New Collection
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {mockCollections.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
