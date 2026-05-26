import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  count?: number
  type?: 'poster' | 'backdrop'
}

export function LoadingSkeleton({ count = 6, type = 'poster' }: LoadingSkeletonProps) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn('flex-shrink-0 rounded-xl overflow-hidden', type === 'poster' ? 'w-44' : 'w-72')}
        >
          {/* Main card skeleton */}
          <div
            className="skeleton w-full rounded-xl"
            style={{ aspectRatio: type === 'poster' ? '2/3' : '16/9' }}
          />
          {/* Title skeleton */}
          <div className="mt-2 space-y-1.5 px-0.5">
            <div className="skeleton h-3.5 w-4/5 rounded-md" />
            {type === 'backdrop' && <div className="skeleton h-3 w-2/5 rounded-md" />}
          </div>
        </div>
      ))}
    </div>
  )
}
