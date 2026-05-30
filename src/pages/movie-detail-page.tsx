import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import {
  Play,
  Heart,
  Bookmark,
  Share2,
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  Languages,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { movies } from '@/data/movies'
import type { Movie } from '@/types'
import { cn, formatDuration, formatRating, formatYear } from '@/utils'
import { MovieCard } from '@/components/system/movie/movie-card'
import { GenreBadge } from '@/components/system/movie/genre-badge'


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
} as const


export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)

  const movie = movies.find((m) => m.id === Number(id))


  const [isFavorited, setIsFavorited] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [shareTooltip, setShareTooltip] = useState(false)

  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0.3])
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.05])

  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">🎬</div>
        <h1 className="text-3xl font-bold text-white">Movie not found</h1>
        <p className="text-zinc-400">We couldn't find that title in our library.</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    )
  }

  const availableSeasons = movie.episodes
    ? [...new Set(movie.episodes.map((e) => e.season))].sort()
    : []

  const similarMovies = movies
    .filter((m) => m.id !== movie.id && m.genres.some((g) => movie.genres.includes(g)))
    .slice(0, 6)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setShareTooltip(true)
    setTimeout(() => setShareTooltip(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* ── HERO SECTION ── */}
      <div ref={heroRef} className="relative w-full h-screen overflow-hidden">
        {/* Backdrop */}
        <motion.div className="absolute inset-0" style={{ opacity: heroOpacity, scale: heroScale }}>
          <img
            src={movie.backdrop}
            alt={movie.title}
            className="object-cover w-full h-full"
          />
        </motion.div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 gradient-overlay" />
        <div className="absolute inset-0 gradient-overlay-right" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-black/30" />

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="absolute top-16 left-4 md:top-24 md:left-8 lg:left-12 z-20 w-10 h-10 flex items-center justify-center rounded-full glass border border-white/15 text-zinc-300 hover:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>

        {/* Hero content */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-16 md:px-8 lg:px-12 max-w-4xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badges row */}
          <motion.div variants={itemVariants} className="flex items-center gap-3 mb-4">
            {movie.isTrending && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-widest">
                Trending
              </span>
            )}
            {movie.isNew && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                New
              </span>
            )}
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-zinc-300 border border-white/15 uppercase tracking-widest">
              {movie.type === 'series' ? 'Series' : 'Movie'}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 drop-shadow-2xl"
          >
            {movie.title}
          </motion.h1>

          {/* Tagline */}
          {movie.tagline && (
            <motion.p
              variants={itemVariants}
              className="text-lg text-zinc-300 italic mb-5 drop-shadow-lg"
            >
              "{movie.tagline}"
            </motion.p>
          )}

          {/* Metadata row */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-sm text-zinc-300"
          >
            <span className="font-semibold text-white">{formatYear(movie.year)}</span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              {formatDuration(movie.duration)}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              {movie.country}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <Languages className="w-3.5 h-3.5 text-zinc-500" />
              {movie.language}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span className="font-bold text-white">{formatRating(movie.rating)}</span>
              <span className="text-zinc-500 text-xs">IMDb</span>
            </span>
            {movie.type === 'series' && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  {availableSeasons.length} {availableSeasons.length === 1 ? 'Season' : 'Seasons'}
                  {' · '}
                  {movie.episodes?.length ?? 0} Episodes
                </span>
              </>
            )}
          </motion.div>

          {/* Genre badges */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-2 mb-7">
            {movie.genres.map((genre) => (
              <GenreBadge key={genre} genre={genre} />
            ))}
          </motion.div>

          {/* Action buttons */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
            {/* Play Now */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/watch/${movie.id}`)}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base shadow-lg shadow-orange-500/30 transition-colors"
            >
              <Play className="w-5 h-5 fill-white" />
              Play Now
            </motion.button>

            {/* Favorite */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsFavorited((v) => !v)}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center border transition-all',
                isFavorited
                  ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                  : 'glass border-white/20 text-zinc-400 hover:text-white',
              )}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={cn('w-5 h-5', isFavorited && 'fill-pink-400')} />
            </motion.button>

            {/* Bookmark */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsBookmarked((v) => !v)}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center border transition-all',
                isBookmarked
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'glass border-white/20 text-zinc-400 hover:text-white',
              )}
              title={isBookmarked ? 'Remove bookmark' : 'Add to watchlist'}
            >
              <Bookmark className={cn('w-5 h-5', isBookmarked && 'fill-blue-400')} />
            </motion.button>

            {/* Share */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="w-12 h-12 rounded-full glass border border-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
              {shareTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-white whitespace-nowrap border border-zinc-700"
                >
                  Link copied!
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── CONTENT SECTION ── */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 bg-background px-4 md:px-8 lg:px-12 py-8"
      >
        <div className="space-y-12">

          {/* ── About ── */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">About</h2>
            <p className="text-zinc-300 leading-relaxed text-base max-w-3xl">{movie.description}</p>
          </section>

          {/* ── Cast ── */}
          {movie.cast && movie.cast.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Cast</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {movie.cast.map((member) => member.name).join(', ')}
              </p>
            </section>
          )}


          {/* ── More Like This ── */}
          {similarMovies.length > 0 && (
            <MoreLikeThisCarousel movies={similarMovies} />
          )}

        </div>
      </motion.div>
    </div>
  )
}

function MoreLikeThisCarousel({ movies: items }: { movies: Movie[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const updateArrows = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 8)
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = rowRef.current
    if (!el) return
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateArrows])

  const scroll = (dir: 'left' | 'right') => {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' })
    setTimeout(updateArrows, 350)
  }

  return (
    <section
      className="relative -mx-4 md:-mx-8 lg:-mx-12"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <h2 className="text-xl font-bold text-white mb-5 px-4 md:px-8 lg:px-12">More Like This</h2>

      <div className="relative">
        <AnimatePresence>
          {showLeft && isHovering && (
            <motion.div
              className="absolute left-0 top-0 bottom-0 z-20 flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="absolute inset-0 w-24 bg-linear-to-r from-background to-transparent pointer-events-none" />
              <button
                className="relative ml-4 md:ml-8 lg:ml-12 w-9 h-9 rounded-full glass border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-lg"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRight && isHovering && (
            <motion.div
              className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="absolute inset-0 bg-linear-to-l from-background to-transparent pointer-events-none" />
              <button
                className="relative mr-4 md:mr-8 lg:mr-12 w-9 h-9 rounded-full glass border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-lg"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={rowRef}
          className="flex gap-4 py-2 px-4 md:px-8 lg:px-12"
          onScroll={updateArrows}
          style={{ overflowX: 'auto', overflowY: 'clip', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((m) => (
            <div key={m.id} className="flex-none w-36 sm:w-40 md:w-44">
              <MovieCard movie={m} size="sm" className="w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
