import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Star, Clock, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration, formatRating, formatYear } from '@/utils/format';
import { GenreBadge } from '@/components/system/movie/genre-badge';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { Movie } from '@/types';

interface HeroBannerProps {
  movies: Movie[]
}

export function HeroBanner({ movies }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const wheelCooldown = useRef(false);

  const activeMovie = movies[activeIndex];

  const goToNext = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % movies.length);
  }, [movies.length]);

  const goToPrev = useCallback(() => {
    setActiveIndex(prev => (prev - 1 + movies.length) % movies.length);
  }, [movies.length]);

  useEffect(() => {
    if (isPaused || movies.length <= 1) return;
    const timer = setInterval(goToNext, 6000);
    return () => clearInterval(timer);
  }, [goToNext, isPaused, movies.length]);

  // Non-passive touch listeners so we can preventDefault on horizontal swipe
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      // If clearly horizontal, block page scroll
      if (dx > dy && dx > 10) e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(delta) > 50) { if (delta > 0) goToNext(); else goToPrev(); }
      touchStartX.current = null;
      touchStartY.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (Math.abs(e.deltaX) < 30) return;
      e.preventDefault(); // blocks browser back/forward navigation
      if (wheelCooldown.current) return;
      wheelCooldown.current = true;
      if (e.deltaX > 0) goToNext(); else goToPrev();
      setTimeout(() => { wheelCooldown.current = false; }, 800);
    };

    const onMouseEnter = () => { document.documentElement.style.overscrollBehaviorX = 'none'; };
    const onMouseLeave = () => { document.documentElement.style.overscrollBehaviorX = ''; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mouseenter', onMouseEnter);
      el.removeEventListener('mouseleave', onMouseLeave);
      document.documentElement.style.overscrollBehaviorX = '';
    };
  }, [goToNext, goToPrev]);


  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    if (Math.abs(e.clientX - mouseStartX.current) > 5) isDragging.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    const delta = mouseStartX.current - e.clientX;
    if (Math.abs(delta) > 60) { if (delta > 0) goToNext(); else goToPrev(); }
    mouseStartX.current = null;
  };

  if (!activeMovie) return null;

  return (
    <section
      ref={sectionRef}
      className="group relative min-h-screen w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={(e) => { setIsPaused(false); handleMouseUp(e); }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ userSelect: 'none', overscrollBehaviorX: 'none' }}
    >
      {/* Backdrop images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMovie.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <img
            src={activeMovie.backdrop}
            alt={activeMovie.title}
            className="w-full h-full object-cover object-center"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="gradient-overlay-right absolute inset-0 z-10" />
      <div className="gradient-overlay absolute inset-0 z-10" />
      {/* Top vignette */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,10,10,0.5) 0%, transparent 20%)',
        }}
      />


      {/* Content */}
      <div className="relative z-20 flex flex-col justify-end min-h-screen pb-28 px-6 md:px-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMovie.id}
            className="w-full md:max-w-[58%]"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* Status badges */}
            <div className="flex items-center gap-2 mb-4">
              {activeMovie.isTrending && (
                <Badge variant="orange" className="px-3 py-1 gap-1 normal-case tracking-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 pulse-orange inline-block" />
                  Trending
                </Badge>
              )}
              {activeMovie.isNew && !activeMovie.isTrending && (
                <Badge variant="emerald" className="px-3 py-1 normal-case tracking-normal">
                  New
                </Badge>
              )}
              {activeMovie.isFeatured && (
                <Badge variant="default" className="px-3 py-1 normal-case tracking-normal bg-amber-500/20 border-amber-500/40 text-amber-400">
                  Featured
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-3 tracking-tight drop-shadow-2xl">
              {activeMovie.title}
            </h1>

            {/* Tagline */}
            {activeMovie.tagline && (
              <p className="text-base md:text-lg italic text-zinc-300 mb-4 font-medium">
                "{activeMovie.tagline}"
              </p>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                {formatYear(activeMovie.year)}
              </span>
              <span className="w-px h-4 bg-zinc-700" />
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {formatDuration(activeMovie.duration)}
              </span>
              <span className="w-px h-4 bg-zinc-700" />
              <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
                <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                {formatRating(activeMovie.rating)}
              </span>
              {activeMovie.type === 'series' && activeMovie.totalSeasons && (
                <>
                  <span className="w-px h-4 bg-zinc-700" />
                  <span className="text-zinc-300 font-medium">
                    {activeMovie.totalSeasons} Season{activeMovie.totalSeasons > 1 ? 's' : ''}
                  </span>
                </>
              )}
              <span className="w-px h-4 bg-zinc-700" />
              <div className="flex flex-wrap gap-1.5">
                {activeMovie.genres.slice(0, 3).map(genre => (
                  <GenreBadge key={genre} genre={genre} />
                ))}
              </div>
            </div>

            {/* Description */}
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed mb-6 line-clamp-3 max-w-xl">
              {activeMovie.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'rounded-xl px-6 py-3 text-sm orange-glow transition-transform hover:scale-[1.03] active:scale-[0.97]')}
              >
                <Play className="w-4 h-4 fill-white" />
                Play Now
              </button>

              <button
                className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'rounded-xl px-6 py-3 text-sm text-white hover:bg-white/15 transition-transform hover:scale-[1.03] active:scale-[0.97]')}
              >
                <Info className="w-4 h-4" />
                More Info
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Indicator dots — centered */}
        {movies.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {movies.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={cn(
                  'rounded-full transition-all duration-300 focus:outline-none cursor-pointer',
                  index === activeIndex
                    ? 'w-6 h-2 bg-orange-500 shadow-md shadow-orange-500/50'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
