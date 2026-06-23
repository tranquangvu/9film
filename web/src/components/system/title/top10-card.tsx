import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Heart } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import type { Title } from '@/types';
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from '@/components/system/common/orange-gradient';
import { useFavoriteButton } from '@/hooks/queries/use-favorites-query';

interface Top10CardProps {
  title: Title
  rank: number
  className?: string
}

export function Top10Card({ title, rank, className }: Top10CardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const favorite = useFavoriteButton(title.id, title.type, title.isFavorite);

  const rankStr = rank.toString();

  return (
    <div
      className={cn(
        'relative flex-shrink-0 flex items-end group/card transition-transform duration-200 ease-out hover:scale-105 hover:z-10',
        className,
      )}
    >
      <span
        className="relative select-none font-black text-[clamp(4rem,9vw,7rem)] leading-none tracking-tighter z-10"
        style={{
          color: 'transparent',
          WebkitTextStroke: '2px rgba(255,255,255,0.15)',
          fontFamily: "'Manrope', sans-serif",
          marginRight: '-0.5rem',
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        {rankStr}
      </span>

      <div
        className="relative flex-shrink-0 w-32 rounded-xl overflow-hidden cursor-pointer"
        style={{ aspectRatio: '2/3', zIndex: 2 }}
        onClick={() => navigate(`/title/${title.id}`)}
      >
        {!imgError ? (
          <img
            src={sizedImage(title.poster, 300)}
            alt={title.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <span className="text-3xl">🎬</span>
          </div>
        )}

        {favorite.active && (
          <button
            onClick={(e) => { e.stopPropagation(); favorite.onToggle(); }}
            aria-label="Remove from favorites"
            title="Remove from favorites"
            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-white/15 border border-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <OrangeGradientDefs />
            <Heart className="w-3 h-3" style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }} />
          </button>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/watch/${title.id}`); }}
            className="relative w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40 transition-transform hover:scale-110 active:scale-95"
          >
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
