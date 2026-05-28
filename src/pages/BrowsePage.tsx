import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { movies, genres } from '@/data/movies'
import { MovieCard } from '@/components/movie/MovieCard'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'

type ContentType = 'movie' | 'series'

const TYPE_OPTIONS: { id: ContentType; label: string; icon: string }[] = [
  { id: 'movie', label: 'Movies', icon: '🎬' },
  { id: 'series', label: 'TV Series', icon: '📺' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set())

  useEffect(() => {
    const genreParam = searchParams.get('genre')
    if (genreParam && genres.some((g) => g.id === genreParam)) {
      setSelectedGenres(new Set([genreParam]))
    }
  }, [searchParams])

  const toggleContentType = (type: ContentType) => {
    setContentType((prev) => (prev === type ? null : type))
    setSearchParams({})
  }

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setSearchParams({})
  }

  const clearContentType = () => setContentType(null)

  const clearGenres = () => {
    setSelectedGenres(new Set())
    setSearchParams({})
  }

  const clearAll = () => {
    setContentType(null)
    setSelectedGenres(new Set())
    setSearchParams({})
  }

  const filtered = useMemo(() => {
    let result = [...movies]

    if (contentType) {
      result = result.filter((m) => m.type === contentType)
    }

    if (selectedGenres.size > 0) {
      const selectedNames = [...selectedGenres].map(
        (id) => genres.find((g) => g.id === id)?.name.toLowerCase() ?? id,
      )
      result = result.filter((m) =>
        m.genres.some((g) => selectedNames.includes(g.toLowerCase())),
      )
    }

    return result.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0))
  }, [contentType, selectedGenres])

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
            const active = contentType === type.id
            return (
              <button
                key={type.id}
                onClick={() => toggleContentType(type.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border',
                  active
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                    : 'text-zinc-400 border-white/10 hover:border-white/20 hover:text-white bg-white/5',
                )}
              >
                <span className="text-base leading-none">{type.icon}</span>
                {type.label}
              </button>
            )
          })}

          <AnimatePresence>
            {contentType !== null && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearContentType}
                aria-label="Clear type filter"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 transition-all border border-orange-500/30"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Row 2 — genres */}
        <div className="flex items-center gap-2 flex-wrap">
          {genres.map((g) => {
            const active = selectedGenres.has(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border',
                  active
                    ? 'border-transparent'
                    : 'text-zinc-400 border-white/10 hover:border-white/20 hover:text-white bg-white/5',
                )}
                style={active ? { background: `${g.color}22`, borderColor: `${g.color}66`, color: g.color } : undefined}
              >
                <span className="text-base leading-none">{g.icon}</span>
                {g.name}
              </button>
            )
          })}

          <AnimatePresence>
            {selectedGenres.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearGenres}
                aria-label="Clear genre filters"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 hover:text-orange-300 transition-all border border-orange-500/30"
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
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
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
  )
}
