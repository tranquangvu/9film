import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MoveRight } from 'lucide-react';
import { cn } from '@/utils';
import type { Movie } from '@/types';
import { MovieCard } from '@/components/system/movie/movie-card';
import { ContinueWatchingCard } from '@/components/system/movie/continue-watching-card';
import { Top10Card } from '@/components/system/movie/top10-card';

interface HorizontalCarouselProps {
  title: string
  movies: Movie[]
  className?: string
  cardType?: 'poster' | 'backdrop' | 'top10'
  showSeeAll?: boolean
}

const SCROLL_AMOUNT = 600;

export function HorizontalCarousel({
  title,
  movies,
  className,
  cardType = 'poster',
  showSeeAll = true,
}: HorizontalCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isHoveringRow, setIsHoveringRow] = useState(false);

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
    <section
      className={cn('relative', className)}
      onMouseEnter={() => setIsHoveringRow(true)}
      onMouseLeave={() => setIsHoveringRow(false)}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-6 md:px-12">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {showSeeAll && (
          <button className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-400 font-medium transition-colors group">
            View all
            <MoveRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Scrollable row */}
      <div className="relative">
        {/* Left fade + arrow */}
        <AnimatePresence>
          {showLeft && isHoveringRow && (
            <motion.div
              className="absolute left-0 top-0 bottom-0 z-20 flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Fade gradient */}
              <div className="absolute inset-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent pointer-events-none" />
              <button
                className="relative ml-6 md:ml-12 w-9 h-9 rounded-full glass border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-lg"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right fade + arrow */}
        <AnimatePresence>
          {showRight && isHoveringRow && (
            <motion.div
              className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
              <button
                className="relative mr-6 md:mr-12 w-9 h-9 rounded-full glass border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-lg"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card row */}
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
          {movies.map((movie, index) => {
            if (cardType === 'backdrop') return <ContinueWatchingCard key={movie.id} movie={movie} />;
            if (cardType === 'top10') return <Top10Card key={movie.id} movie={movie} rank={index + 1} />;
            return <MovieCard key={movie.id} movie={movie} showProgress />;
          })}
        </div>
      </div>
    </section>
  );
}
