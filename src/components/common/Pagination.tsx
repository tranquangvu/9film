import { MoveLeft, MoveRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}

export function Pagination({ page, totalPages, onPrevious, onNext }: PaginationProps) {
  if (totalPages <= 1) return null

  const buttonClass = (disabled: boolean) =>
    cn(
      'flex items-center justify-center w-12 h-6 rounded-xl text-sm font-medium transition-all border',
      disabled
        ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-default'
        : 'border-zinc-700 bg-surface-2 text-zinc-300 hover:border-zinc-500 hover:text-white hover:bg-white/5',
    )

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={onPrevious}
        disabled={page <= 1}
        aria-label="Previous page"
        className={buttonClass(page <= 1)}
      >
        <MoveLeft className="w-4 h-4" />
      </button>

      <button
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
        className={buttonClass(page >= totalPages)}
      >
        <MoveRight className="w-4 h-4" />
      </button>
    </div>
  )
}
