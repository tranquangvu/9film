import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration } from '@/utils/format';
import type { Episode } from '@/types';

interface EpisodeCardProps {
  episode: Episode
  isActive?: boolean
  onPlay?: () => void
}

export function EpisodeCard({ episode, isActive = false, onPlay }: EpisodeCardProps) {
  const [imgError, setImgError] = useState(false);
  const [thumbHovered, setThumbHovered] = useState(false);

  return (
    <motion.div
      className={cn(
        'flex gap-4 p-3 rounded-xl cursor-pointer transition-colors group',
        isActive
          ? 'bg-orange-500/10 border border-orange-500/30'
          : 'hover:bg-white/5 border border-transparent',
      )}
      whileTap={{ scale: 0.99 }}
      onClick={onPlay}
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 w-36 rounded-lg overflow-hidden bg-zinc-800"
        style={{ aspectRatio: '16/9' }}
        onMouseEnter={() => setThumbHovered(true)}
        onMouseLeave={() => setThumbHovered(false)}
      >
        {!imgError ? (
          <img
            src={episode.thumbnail}
            alt={episode.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800" />
        )}

        {/* Play overlay */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/40"
          animate={{ opacity: thumbHovered || isActive ? 1 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center',
              isActive ? 'bg-orange-500' : 'bg-white/20 backdrop-blur-sm',
            )}
          >
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </motion.div>
      </div>

      {/* Episode details */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-wider',
              isActive ? 'text-orange-500' : 'text-zinc-500',
            )}
          >
            E{episode.number}
          </span>
          {isActive && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 uppercase tracking-wide border border-orange-500/30">
              Now Playing
            </span>
          )}
        </div>

        <p
          className={cn(
            'text-sm font-semibold line-clamp-1',
            isActive ? 'text-orange-100' : 'text-white group-hover:text-orange-100 transition-colors',
          )}
        >
          {episode.title}
        </p>

        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{episode.description}</p>

        {episode.duration > 0 && (
          <p className="text-xs text-zinc-600 mt-0.5">{formatDuration(episode.duration)}</p>
        )}
      </div>
    </motion.div>
  );
}
