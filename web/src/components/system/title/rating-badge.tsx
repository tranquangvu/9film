import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatRating } from '@/utils/format';
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from '@/components/system/common/orange-gradient';

interface RatingBadgeProps {
  rating: number
  className?: string
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full font-bold tabular-nums',
        'bg-white/15 border border-white/15 backdrop-blur-sm',
        className,
      )}
    >
      <OrangeGradientDefs />
      <Star className="w-3 h-3 mt-[2px]" style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }} />
      <span className="text-white text-xs">{formatRating(rating)}</span>
    </span>
  );
}
