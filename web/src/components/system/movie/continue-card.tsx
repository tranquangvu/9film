import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import { formatDuration } from '@/utils/format';
import type { Movie } from '@/types';

interface ContinueWatchingCardProps {
  movie: Movie
  className?: string
}

export function ContinueWatchingCard({ movie, className }: ContinueWatchingCardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const progress = movie.progress ?? 0;
  const remaining = Math.round((movie.duration * (100 - progress)) / 100);

  const handleClick = () => navigate(`/movie/${movie.id}`);

  return (
    <div
      className={cn('relative flex-shrink-0 cursor-pointer w-72 group/card transition-transform duration-200 ease-out hover:scale-[1.04] hover:z-10', className)}
      onClick={handleClick}
    >
      {/* 16:9 backdrop container */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '16/9' }}>
        {/* Backdrop image */}
        {!imgError ? (
          <img
            src={sizedImage(movie.backdrop, 640)}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-zinc-600 text-xs">{movie.title}</span>
          </div>
        )}

        {/* Permanent bottom gradient — strong enough to work on bright images */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        {/* Title + progress text over image */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <p className="text-white text-sm font-semibold truncate leading-snug"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 2px 12px rgba(0,0,0,0.9)' }}>
            {movie.title}
          </p>
          <p className="text-zinc-400 text-xs mt-0.5"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,1)' }}>
            {movie.resumeSeason ? `S${movie.resumeSeason} · E${movie.resumeEpisode} · ` : ''}
            {progress}% watched · {formatDuration(remaining)} left
          </p>
        </div>

        {/* Hover play overlay (CSS-only) */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/50 transition-transform hover:scale-110 active:scale-95">
            <Play className="w-6 h-6 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Progress bar at very bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
