import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import { formatDuration, formatYear } from '@/utils/format';
import type { Movie } from '@/types';
import { RatingBadge } from '@/components/system/movie/rating-badge';
import { GenreBadge } from '@/components/system/movie/genre-badge';
import { useFavoriteButton } from '@/hooks/queries/use-favorites-query';

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
};

export function MovieCard({ movie, className, showProgress = false, size = 'md' }: MovieCardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const favorite = useFavoriteButton(movie.id, movie.type, movie.isFavorite);

  const handleClick = () => navigate(`/movie/${movie.id}`);

  return (
    <div
      className={cn(
        'relative flex-shrink-0 cursor-pointer group/card transition-transform duration-200 ease-out hover:scale-[1.08] hover:z-10',
        sizeClasses[size],
        className,
      )}
      onClick={handleClick}
    >
      {/* Poster container — 2:3 aspect ratio */}
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '2/3' }}>
        {/* Poster image */}
        {!imgError ? (
          <img
            src={sizedImage(movie.poster, 400)}
            alt={movie.title}
            loading="lazy"
            decoding="async"
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

        {/* Top-right: New badge + favorite indicator (only shown when favorited) */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {movie.isNew && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wide">
              New
            </span>
          )}
          {favorite.active && (
            <button
              onClick={favorite.onToggle}
              aria-label="Remove from favorites"
              title="Remove from favorites"
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Heart className="w-3 h-3 fill-orange-500 text-orange-500" />
            </button>
          )}
        </div>

        {/* Hover overlay (CSS-only) */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/card:pointer-events-auto">
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 rounded-xl" />

          {/* Play button — centered */}
          <div className="relative flex-1 flex items-center justify-center">
            <button
              className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40 transition-transform hover:scale-110 active:scale-95"
              onClick={(e) => { e.stopPropagation(); handleClick(); }}
            >
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </button>
          </div>

          {/* Bottom info */}
          <div className="relative px-2.5 pb-3 space-y-1.5">
            <p className="text-white font-semibold text-sm leading-tight line-clamp-2">{movie.title}</p>

            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <span>{formatYear(movie.year)}</span>
              {movie.duration > 0 && (
                <>
                  <span className="w-1 h-1 bg-zinc-400 rounded-full inline-block" />
                  <span>{formatDuration(movie.duration)}</span>
                </>
              )}
            </div>

            {/* Genre badges row */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {movie.genres.slice(0, 2).map((g) => (
                <GenreBadge key={g} genre={g} className="text-[10px] px-1.5 py-0" />
              ))}
            </div>
          </div>
        </div>

        {/* Default title overlay — hidden on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-6.5 opacity-100 group-hover/card:opacity-0 transition-opacity duration-200"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
          }}
        >
          <p className="text-white text-sm font-bold line-clamp-2 leading-snug">
            {movie.title}
          </p>
        </div>

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
    </div>
  );
}
