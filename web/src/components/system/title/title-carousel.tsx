import { useRef, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoveRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import type { Title } from '@/types';
import { TitleCard } from '@/components/system/title/title-card';
import { ContinueWatchingCard } from '@/components/system/title/continue-card';
import { Top10Card } from '@/components/system/title/top10-card';

interface HorizontalCarouselProps {
  title: string
  titles: Title[]
  className?: string
  cardType?: 'poster' | 'backdrop' | 'top10'
  showSeeAll?: boolean
  /** Destination for the "View all" link; the link only shows when set. */
  viewAllTo?: string
  /** When set, "View all" renders as a button calling this instead of a link. */
  onViewAll?: () => void
}

const SCROLL_AMOUNT = 600;

export function HorizontalCarousel({
  title,
  titles,
  className,
  cardType = 'poster',
  showSeeAll = true,
  viewAllTo,
  onViewAll,
}: HorizontalCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  const scroll = (dir: 'left' | 'right') => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  };

  return (
    <section className={cn('group/row relative', className)}>
      <div className="flex items-center justify-between mb-4 px-6 md:px-12">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {showSeeAll && onViewAll ? (
          <button
            onClick={onViewAll}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-400 border-0 bg-transparent hover:bg-transparent p-0 font-medium transition-colors group/seeall shadow-none',
            )}
          >
            View all
            <MoveRight className="w-4 h-4 transition-transform group-hover/seeall:translate-x-0.5" />
          </button>
        ) : showSeeAll && viewAllTo ? (
          <Link
            to={viewAllTo}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-400 border-0 bg-transparent hover:bg-transparent p-0 font-medium transition-colors group/seeall shadow-none',
            )}
          >
            View all
            <MoveRight className="w-4 h-4 transition-transform group-hover/seeall:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      <div className="relative">
        {showLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
            <div className="absolute inset-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent pointer-events-none" />
            <button
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'relative ml-6 md:ml-12 text-white hover:bg-white/20 hover:text-white hover:border-white/20 hover:scale-100 shadow-lg')}
              onClick={() => scroll('left')}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {showRight && (
          <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-end opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
            <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
            <button
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'relative mr-6 md:mr-12 text-white hover:bg-white/20 hover:text-white hover:border-white/20 hover:scale-100 shadow-lg')}
              onClick={() => scroll('right')}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          ref={rowRef}
          className="flex gap-4 hide-scrollbar py-4 pl-6 md:pl-12 pr-6 md:pr-12"
          onScroll={updateArrows}
          style={{
            overflowX: 'auto',
            overflowY: 'clip',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {titles.map((title, index) => {
            if (cardType === 'backdrop') return <ContinueWatchingCard key={title.id} title={title} />;
            if (cardType === 'top10') return <Top10Card key={title.id} title={title} rank={index + 1} />;
            return <TitleCard key={title.id} title={title} showProgress />;
          })}
        </div>
      </div>
    </section>
  );
}
