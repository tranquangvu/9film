import { cn } from '@/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

const cardWidths = { sm: 'w-32', md: 'w-44', lg: 'w-56' } as const;

type CardSize = keyof typeof cardWidths;

/** Mirrors MovieCard: a 2:3 poster at the same fixed widths. */
export function MovieCardSkeleton({ size = 'md', className }: { size?: CardSize; className?: string }) {
  return (
    <div className={cn('flex-shrink-0', cardWidths[size], className)}>
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: '2/3' }} />
    </div>
  );
}

/** Mirrors ContinueWatchingCard: a 16:9 backdrop, w-72. */
export function ContinueCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex-shrink-0 w-72', className)}>
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: '16/9' }} />
    </div>
  );
}

/** Mirrors Top10Card: outlined rank number + w-32 2:3 poster. */
export function Top10CardSkeleton({ rank }: { rank: number }) {
  return (
    <div className="relative flex-shrink-0 flex items-end">
      <span
        className="select-none font-black text-[clamp(4rem,9vw,7rem)] leading-none tracking-tighter"
        style={{
          color: 'transparent',
          WebkitTextStroke: '2px rgba(255,255,255,0.1)',
          marginRight: '-0.5rem',
          flexShrink: 0,
        }}
      >
        {rank}
      </span>
      <Skeleton className="flex-shrink-0 w-32 rounded-xl" style={{ aspectRatio: '2/3' }} />
    </div>
  );
}

type CarouselCardType = 'poster' | 'backdrop' | 'top10';

/** Mirrors HorizontalCarousel: header row + a scrolling strip of card skeletons. */
export function CarouselSkeleton({
  cardType = 'poster',
  count = 8,
}: {
  cardType?: CarouselCardType;
  count?: number;
}) {
  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-4 px-6 md:px-12">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex gap-4 py-4 pl-6 md:pl-12 pr-6 md:pr-12 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => {
          if (cardType === 'backdrop') return <ContinueCardSkeleton key={i} />;
          if (cardType === 'top10') return <Top10CardSkeleton key={i} rank={i + 1} />;
          return <MovieCardSkeleton key={i} />;
        })}
      </div>
    </section>
  );
}

/** Mirrors the responsive poster grid used on the Movies/TV/Browse pages. */
export function MovieGridSkeleton({ count = 15 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} size="lg" className="w-full" />
      ))}
    </div>
  );
}

/** Mirrors the poster tile used in the search overlay grids (poster + footer). */
export function PosterTileSkeleton() {
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Skeleton className="aspect-[2/3] rounded-none" />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Mirrors a SearchResultRow list inside its surface container. */
export function SearchResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden divide-y divide-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          <Skeleton className="shrink-0 w-16 h-24 rounded-lg" />
          <div className="grow py-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex gap-1.5 pt-0.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="shrink-0 h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors HeroBanner: full-screen backdrop with bottom-left content block. */
export function HeroBannerSkeleton() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 via-orange-900/20 to-background" />
      <div className="gradient-overlay-right absolute inset-0 z-10" />
      <div className="gradient-overlay absolute inset-0 z-10" />

      <div className="relative z-20 flex flex-col justify-end min-h-screen pb-28 px-6 md:px-12">
        <div className="w-full md:max-w-[50%]">
          {/* Title */}
          <Skeleton className="h-6 md:h-8 w-1/3 rounded-lg mb-4" />

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Description */}
          <div className="space-y-2.5 max-w-xl mb-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Skeleton className="h-12 w-32 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mirrors MovieDetailPage: full-screen hero + Episodes, About, Cast, More Like This. */
export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-surface-2 to-background" />
        <div className="absolute inset-0 gradient-overlay" />
        <div className="absolute inset-0 gradient-overlay-right" />

        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-28 md:px-8 lg:px-12 max-w-4xl space-y-5">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-6 lg:h-8 w-2/3 rounded-lg" />
          <div className="flex flex-wrap items-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          <div className="flex items-center gap-4 pt-1">
            <Skeleton className="h-12 w-36 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 pt-0 pb-8 space-y-10">
        {/* Episodes — season select + episode pills */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-12 rounded-full" />
            ))}
          </div>
        </div>

        {/* About — heading + paragraph lines */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full max-w-3xl" />
          <Skeleton className="h-4 w-5/6 max-w-3xl" />
          <Skeleton className="h-4 w-4/6 max-w-3xl" />
        </div>

        {/* Cast — avatar + name/character rows */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-20" />
          <div className="flex flex-wrap gap-x-6 gap-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 w-44">
                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* More Like This — responsive poster grid */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <MovieCardSkeleton key={i} size="lg" className="w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
