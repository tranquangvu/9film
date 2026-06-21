import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import { formatDuration, formatYear } from '@/utils/format';
import type { Movie } from '@/types';
import { RatingBadge } from '@/components/system/movie/rating-badge';
import { GenreBadge } from '@/components/system/movie/genre-badge';
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from '@/components/system/common/orange-gradient';
import { useFavoriteButton } from '@/hooks/queries/use-favorites-query';

interface MovieCardProps {
  movie: Movie
  className?: string
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
  onRemove?: () => void
}

const sizeClasses = {
  sm: 'w-32',
  md: 'w-44',
  lg: 'w-56',
};

export function MovieCard({ movie, className, showProgress = false, size = 'md', onRemove }: MovieCardProps) {
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
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '2/3' }}>
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

        <div className="absolute top-2 left-2">
          <RatingBadge rating={movie.rating} />
        </div>

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
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white/15 border border-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <OrangeGradientDefs />
              <Heart className="w-3 h-3" style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }} />
            </button>
          )}
        </div>

        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remove from list"
            title="Remove from list"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+16px)] z-20 w-9 h-9 rounded-full bg-white text-black shadow-lg flex items-center justify-center transition-all opacity-0 group-hover/card:opacity-100 hover:bg-red-50 hover:scale-110 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        <div className="absolute inset-0 flex flex-col justify-between opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/card:pointer-events-auto">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 rounded-xl" />

          <div className="relative flex-1 flex items-center justify-center">
            <button
              className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40 transition-transform hover:scale-110 active:scale-95"
              onClick={(e) => { e.stopPropagation(); handleClick(); }}
            >
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </button>
          </div>

          <div className="relative px-2.5 pb-3 space-y-1.5">
            <p className="text-white font-semibold text-sm leading-tight line-clamp-2">{movie.title}</p>

            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <span>{formatYear(movie.year)}</span>
              {movie.duration > 0 && (
                <>
                  <span className="w-px h-3 bg-zinc-600 inline-block" />
                  <span>{formatDuration(movie.duration)}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 pt-0.5">
              {movie.genres.slice(0, 2).map((g) => (
                <GenreBadge key={g} genre={g} className="text-[10px] px-1.5 py-0" />
              ))}
            </div>
          </div>
        </div>

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
