import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'
import type { Movie } from '@/types'

interface ContinueWatchingCardProps {
  movie: Movie
  className?: string
}

export function ContinueWatchingCard({ movie, className }: ContinueWatchingCardProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const progress = movie.progress ?? 0
  const remaining = Math.round((movie.duration * (100 - progress)) / 100)

  const handleClick = () => navigate(`/movie/${movie.id}`)

  return (
    <motion.div
      className={cn('relative flex-shrink-0 cursor-pointer w-72', className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.04 : 1, zIndex: isHovered ? 10 : 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onClick={handleClick}
    >
      {/* 16:9 backdrop container */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '16/9' }}>
        {/* Backdrop image */}
        {!imgError ? (
          <img
            src={movie.backdrop}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-zinc-600 text-xs">{movie.title}</span>
          </div>
        )}

        {/* Permanent bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Hover play overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <motion.div
                className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/50"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play className="w-6 h-6 fill-white text-white ml-0.5" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar at very bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card footer */}
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {progress}% watched · {formatDuration(remaining)} left
          </p>
        </div>
        <motion.button
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold transition-colors"
          whileTap={{ scale: 0.96 }}
          onClick={(e) => { e.stopPropagation(); handleClick() }}
        >
          <Play className="w-3 h-3 fill-white text-white" />
          Continue
        </motion.button>
      </div>
    </motion.div>
  )
}
