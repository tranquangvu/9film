import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play, Heart, Info } from 'lucide-react'
import { cn, formatDuration, formatYear } from '@/lib/utils'
import type { Movie } from '@/types'
import { RatingBadge } from './RatingBadge'
import { GenreBadge } from './GenreBadge'

interface MovieCardProps {
  movie: Movie
  className?: string
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-32',
  md: 'w-44',
  lg: 'w-56',
}

export function MovieCard({ movie, className, showProgress = false, size = 'md' }: MovieCardProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleClick = () => navigate(`/movie/${movie.id}`)

  return (
    <motion.div
      className={cn('relative flex-shrink-0 cursor-pointer group', sizeClasses[size], className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.08 : 1, zIndex: isHovered ? 10 : 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={handleClick}
      style={{ position: 'relative' }}
    >
      {/* Poster container — 2:3 aspect ratio */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '2/3' }}>
        {/* Poster image */}
        {!imgError ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-zinc-600 text-xs text-center px-2">{movie.title}</span>
          </div>
        )}

        {/* Base badges (always visible) */}
        <div className="absolute top-2 left-2">
          <RatingBadge rating={movie.rating} />
        </div>

        {movie.isNew && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide">
              New
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 flex flex-col justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Dark gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 rounded-xl" />

              {/* Play button — centered */}
              <div className="relative flex-1 flex items-center justify-center">
                <motion.button
                  className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40"
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); handleClick() }}
                >
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </motion.button>
              </div>

              {/* Bottom info */}
              <div className="relative px-2.5 pb-3 space-y-1.5">
                <p className="text-white font-semibold text-sm leading-tight line-clamp-2">{movie.title}</p>
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                  <span>{formatYear(movie.year)}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{formatDuration(movie.duration)}</span>
                </div>

                {/* Genre badges row */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {movie.genres.slice(0, 2).map((g) => (
                    <GenreBadge key={g} genre={g} />
                  ))}
                </div>

                {/* Action icons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Add to list"
                  >
                    <Heart className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleClick() }}
                    title="More info"
                  >
                    <Info className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        {showProgress && movie.progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${movie.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Title below card (base state, hidden on hover) */}
      <motion.p
        className="mt-2 text-sm text-zinc-300 font-medium line-clamp-1 px-0.5"
        animate={{ opacity: isHovered ? 0 : 1 }}
        transition={{ duration: 0.15 }}
      >
        {movie.title}
      </motion.p>
    </motion.div>
  )
}
