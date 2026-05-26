import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Play,
  Heart,
  Bookmark,
  Share2,
  ArrowLeft,
  Star,
  Calendar,
  Film,
  Clock,
  MapPin,
  Languages,
  DollarSign,
  User,
} from 'lucide-react'
import { movies } from '@/data/movies'
import { cn, formatDuration, formatRating, formatYear } from '@/lib/utils'
import { MovieCard } from '@/components/movie/MovieCard'
import { EpisodeCard } from '@/components/movie/EpisodeCard'
import { GenreBadge } from '@/components/movie/GenreBadge'
import { RatingBadge } from '@/components/movie/RatingBadge'

const MOCK_BUDGETS: Record<number, string> = {
  1: '$100M', 2: '$200M', 3: '$145M', 4: '$160M', 5: '$190M',
  6: '$185M', 7: '$165M', 8: '$356M', 9: '$185M', 10: 'N/A',
  11: 'N/A', 12: 'N/A', 13: '$35M', 14: '$200M', 15: '$168M', 16: '$50M',
}

const mockReviews = [
  {
    id: 1,
    user: 'Alex M.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexM',
    rating: 9,
    text: 'An absolute masterpiece. The direction, the performances, the score — everything fires on all cylinders. One of the best films in years.',
    date: 'Jan 5, 2024',
  },
  {
    id: 2,
    user: 'Sarah K.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahK',
    rating: 8,
    text: 'Visually stunning and emotionally resonant. The pacing might test some patience but the payoff is absolutely worth it.',
    date: 'Dec 20, 2023',
  },
  {
    id: 3,
    user: 'James T.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JamesT',
    rating: 10,
    text: 'I was completely blown away. This is cinema at its finest — bold, uncompromising, and utterly unforgettable.',
    date: 'Dec 15, 2023',
  },
  {
    id: 4,
    user: 'Priya S.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaS',
    rating: 7,
    text: 'Great film overall. Some scenes drag a bit but the lead performances alone make it worth every minute.',
    date: 'Nov 30, 2023',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const castCardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)

  const movie = movies.find((m) => m.id === Number(id))


  const [isFavorited, setIsFavorited] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [activeSeason, setActiveSeason] = useState(1)
  const [activeEpisode, setActiveEpisode] = useState<number | null>(null)
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

  const episodesBySeason = movie.episodes
    ? movie.episodes.filter((e) => e.season === activeSeason)
    : []

  const similarMovies = movies
    .filter((m) => m.id !== movie.id && m.genres.some((g) => movie.genres.includes(g)))
    .slice(0, 6)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setShareTooltip(true)
    setTimeout(() => setShareTooltip(false), 2000)
  }

  const budget = MOCK_BUDGETS[movie.id] ?? 'N/A'

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
          className="absolute top-6 left-6 z-20 flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>

        {/* Hero content */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-16 md:px-16 lg:px-20 max-w-4xl"
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
            {movie.type === 'series' && movie.totalSeasons && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-300">{movie.totalSeasons} Seasons</span>
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

            {/* Watch Trailer */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-full glass border border-white/20 text-white font-semibold text-base hover:bg-white/10 transition-colors"
            >
              <Play className="w-4 h-4" />
              Watch Trailer
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
        className="relative z-10 bg-background px-6 md:px-12 lg:px-20 py-14"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">

          {/* ── MAIN CONTENT ── */}
          <div className="space-y-14">

            {/* Description */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4">About</h2>
              <p className="text-zinc-300 leading-relaxed text-base">{movie.description}</p>
            </section>

            {/* Cast Section */}
            {movie.cast && movie.cast.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-6">Cast</h2>
                <div className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar">
                  {movie.cast.map((member, i) => (
                    <motion.div
                      key={member.id}
                      custom={i}
                      variants={castCardVariants}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: '-50px' }}
                      className="shrink-0 w-28 text-center group"
                    >
                      <div className="w-20 h-20 mx-auto rounded-full overflow-hidden mb-2.5 ring-2 ring-white/10 group-hover:ring-orange-500/50 transition-all duration-300">
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const t = e.currentTarget
                            t.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`
                          }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-2 mb-0.5">
                        {member.name}
                      </p>
                      <p className="text-xs text-zinc-500 line-clamp-1">{member.character}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Episodes Section — series only */}
            {movie.type === 'series' && movie.episodes && movie.episodes.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-white mb-5">Episodes</h2>

                {/* Season tabs */}
                {availableSeasons.length > 1 && (
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {availableSeasons.map((season) => (
                      <button
                        key={season}
                        onClick={() => setActiveSeason(season)}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-sm font-semibold border transition-all',
                          activeSeason === season
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-white/15 text-zinc-400 hover:text-white hover:border-white/30',
                        )}
                      >
                        Season {season}
                      </button>
                    ))}
                  </div>
                )}

                {/* Episode list */}
                <div className="space-y-2">
                  {episodesBySeason.map((ep) => (
                    <EpisodeCard
                      key={ep.id}
                      episode={ep}
                      isActive={activeEpisode === ep.id}
                      onPlay={() => {
                        setActiveEpisode(ep.id)
                        navigate(`/watch/${movie.id}?episode=${ep.id}`)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Reviews</h2>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                  <span className="text-white font-bold">{formatRating(movie.rating)}</span>
                  <span className="text-zinc-500 text-sm">/ 10</span>
                </div>
              </div>

              <div className="space-y-4">
                {mockReviews.map((review, i) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="p-5 rounded-2xl bg-surface border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <img
                        src={review.avatar}
                        alt={review.user}
                        className="w-10 h-10 rounded-full shrink-0 bg-zinc-800"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-white text-sm">{review.user}</span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <Star
                                  key={j}
                                  className={cn(
                                    'w-3 h-3',
                                    j < Math.round(review.rating / 2)
                                      ? 'fill-orange-500 text-orange-500'
                                      : 'text-zinc-700',
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-orange-400 font-semibold">{review.rating}/10</span>
                          </div>
                          <span className="text-xs text-zinc-600 shrink-0">{review.date}</span>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed">{review.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="space-y-8">

            {/* Movie metadata card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="rounded-2xl bg-surface border border-white/5 overflow-hidden"
            >
              {/* Poster header */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={movie.backdrop}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2">
                    <RatingBadge rating={movie.rating} />
                    {movie.isNew && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata list */}
              <div className="p-5 space-y-3.5">
                <MetaRow icon={<User className="w-4 h-4" />} label="Director" value={movie.director} />
                <MetaRow icon={<Calendar className="w-4 h-4" />} label="Released" value={formatYear(movie.year)} />
                <MetaRow icon={<Languages className="w-4 h-4" />} label="Language" value={movie.language} />
                <MetaRow icon={<MapPin className="w-4 h-4" />} label="Country" value={movie.country} />
                <MetaRow icon={<Clock className="w-4 h-4" />} label="Duration" value={formatDuration(movie.duration)} />
                <MetaRow icon={<DollarSign className="w-4 h-4" />} label="Budget" value={budget} />
                {movie.type === 'series' && movie.totalSeasons && (
                  <MetaRow icon={<Film className="w-4 h-4" />} label="Seasons" value={`${movie.totalSeasons} Seasons`} />
                )}
              </div>

              {/* Genre badges */}
              <div className="px-5 pb-5 flex flex-wrap gap-1.5">
                {movie.genres.map((g) => (
                  <GenreBadge key={g} genre={g} />
                ))}
              </div>
            </motion.div>

            {/* Similar Movies */}
            {similarMovies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85, duration: 0.6 }}
              >
                <h3 className="text-lg font-bold text-white mb-4">More Like This</h3>
                <div className="grid grid-cols-2 gap-3">
                  {similarMovies.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.07, duration: 0.4 }}
                    >
                      <MovieCard movie={m} size="sm" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </aside>
        </div>
      </motion.div>
    </div>
  )
}

interface MetaRowProps {
  icon: React.ReactNode
  label: string
  value: string
}

function MetaRow({ icon, label, value }: MetaRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-600 shrink-0">{icon}</span>
      <span className="text-zinc-500 text-sm shrink-0 w-20">{label}</span>
      <span className="text-white text-sm font-medium truncate">{value}</span>
    </div>
  )
}
