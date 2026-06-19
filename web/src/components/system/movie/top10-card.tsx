import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import type { Movie } from '@/types';
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from '@/components/system/common/orange-gradient';
import { useFavoriteButton } from '@/hooks/queries/use-favorites-query';

interface Top10CardProps {
  movie: Movie
  rank: number
  className?: string
}

export function Top10Card({ movie, rank, className }: Top10CardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const favorite = useFavoriteButton(movie.id, movie.type, movie.isFavorite);

  const rankStr = rank.toString();

  return (
    <div
      className={cn(
        'relative flex-shrink-0 flex items-end group/card transition-transform duration-200 ease-out hover:scale-105 hover:z-10',
        className,
      )}
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
            src={sizedImage(movie.poster, 300)}
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

        {/* Hover overlay (CSS-only) */}
        <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="relative z-10 p-2 flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/watch/${movie.id}`); }}
              className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors shadow-lg shadow-orange-500/30"
            >
              <Play className="w-3.5 h-3.5 fill-white text-white" />
            </button>
            <button
              onClick={favorite.onToggle}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                favorite.active ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 hover:bg-white/20 text-white',
              )}
              title={favorite.active ? 'Remove from favorites' : 'Add to favorites'}
            >
              <OrangeGradientDefs />
              <Heart
                className="w-3.5 h-3.5"
                style={favorite.active ? { fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL } : undefined}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
