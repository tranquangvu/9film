import { cn } from '@/utils'

interface GenreBadgeProps {
  genre: string
  className?: string
}

export function GenreBadge({ genre, className }: GenreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        'bg-white/10 border border-white/15 text-zinc-300 backdrop-blur-sm',
        'whitespace-nowrap',
        className,
      )}
    >
      {genre}
    </span>
  )
}
