import { Star } from 'lucide-react'
import { cn } from '@/utils'
import { formatRating } from '@/utils'

interface RatingBadgeProps {
  rating: number
  className?: string
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        'bg-black/50 backdrop-blur-sm border border-white/10',
        className,
      )}
    >
      <Star className="w-3 h-3 fill-orange-500 text-orange-500" />
      <span className="text-white">{formatRating(rating)}</span>
    </span>
  )
}
