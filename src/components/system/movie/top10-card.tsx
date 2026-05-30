import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { cn } from '@/utils';
import type { Movie } from '@/types';

interface Top10CardProps {
  movie: Movie
  rank: number
  className?: string
}

export function Top10Card({ movie, rank, className }: Top10CardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const rankStr = rank.toString();

  return (
    <motion.div
      className={cn('relative flex-shrink-0 flex items-end', className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.05 : 1, zIndex: isHovered ? 10 : 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ position: 'relative' }}
    >
      {/* Big rank number */}
      <span
        className="relative select-none font-black text-[clamp(4rem,9vw,7rem)] leading-none tracking-tighter z-10"
        style={{
          color: 'transparent',
          WebkitTextStroke: '2px rgba(255,255,255,0.15)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginRight: '-0.5rem',
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        {rankStr}
      </span>

      {/* Poster */}
      <div
        className="relative flex-shrink-0 w-32 rounded-xl overflow-hidden cursor-pointer"
        style={{ aspectRatio: '2/3', zIndex: 2 }}
        onClick={() => navigate(`/movie/${movie.id}`)}
      >
        {!imgError ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <span className="text-3xl">🎬</span>
          </div>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 flex flex-col justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative z-10 p-2 flex items-center justify-between">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/watch/${movie.id}`); }}
                  className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors shadow-lg shadow-orange-500/30"
                >
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                </button>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Heart className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
