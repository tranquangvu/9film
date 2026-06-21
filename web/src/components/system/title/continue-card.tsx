import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { sizedImage } from '@/utils/image';
import { formatDuration } from '@/utils/format';
import type { Title } from '@/types';

interface ContinueWatchingCardProps {
  title: Title
  className?: string
}

export function ContinueWatchingCard({ title, className }: ContinueWatchingCardProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const progress = title.progress ?? 0;
  const remaining = Math.round((title.duration * (100 - progress)) / 100);

  // Continue Watching jumps straight into playback, resuming at the saved
  // season/episode for series.
  const handleClick = () => {
    const resume =
      title.resumeSeason != null
        ? `?s=${title.resumeSeason}&e=${title.resumeEpisode}`
        : '';
    navigate(`/watch/${title.id}${resume}`);
  };

  return (
    <div
      className={cn('relative flex-shrink-0 cursor-pointer w-72 group/card transition-transform duration-200 ease-out hover:scale-[1.04] hover:z-10', className)}
      onClick={handleClick}
    >
      <div className="relative w-full rounded-xl overflow-hidden bg-[#1a1a1a]" style={{ aspectRatio: '16/9' }}>
        {!imgError ? (
          <img
            src={sizedImage(title.backdrop, 640)}
            alt={title.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-zinc-600 text-xs">{title.title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3 z-10">
          <p className="text-white text-sm font-semibold truncate leading-snug"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,1), 0 2px 12px rgba(0,0,0,0.9)' }}>
            {title.title}
          </p>
          <p className="text-zinc-400 text-xs mt-0.5"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,1)' }}>
            {title.resumeSeason ? `S${title.resumeSeason} · E${title.resumeEpisode} · ` : ''}
            {progress}% watched{title.duration > 0 ? ` · ${formatDuration(remaining)} left` : ''}
          </p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/50 transition-transform hover:scale-110 active:scale-95">
            <Play className="w-6 h-6 fill-white text-white ml-0.5" />
          </div>
        </div>

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
