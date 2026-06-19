import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatRating } from '@/utils/format';

interface RatingBadgeProps {
  rating: number
  className?: string
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full font-bold tabular-nums',
        'bg-white/15 backdrop-blur-sm',
        className,
      )}
    >
      <Star className="w-3 h-3 fill-orange-500 text-orange-500 mt-[2px]" />
      <span className="text-white text-xs">{formatRating(rating)}</span>
    </span>
  );
}
