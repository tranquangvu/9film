import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Info, Star, Clock, Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatDuration, formatRating, formatYear } from '@/utils/format';
import { GenreBadge } from '@/components/system/movie/genre-badge';
import { OrangeGradientDefs, ORANGE_GRADIENT_FILL } from '@/components/system/common/orange-gradient';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { Movie } from '@/types';

interface HeroBannerProps {
  movies: Movie[]
}

export function HeroBanner({ movies }: HeroBannerProps) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  // The backdrop shown as the opaque base layer. The active backdrop fades in on
  // top of it and, once the fade finishes, becomes the new base — so a fully
  // opaque layer is always underneath and the crossfade never dips to black.
  const [baseIndex, setBaseIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const wheelCooldown = useRef(false);

  const activeMovie = movies[activeIndex];
  const baseMovie = movies[baseIndex] ?? activeMovie;

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
      {/* Backdrop images — the base layer stays fully opaque while the incoming
          backdrop fades in on top, so the composite never dips to black. */}
      <div className="absolute inset-0 bg-black">
        {/* Stable element (no key) so it fades in once on first load, then just
            swaps src under the crossfade layer without re-animating. */}
        <motion.img
          src={baseMovie.backdrop}
          alt={baseMovie.title}
          className="absolute inset-0 w-full h-full object-cover object-center"
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        {activeIndex !== baseIndex && (
          <motion.img
            key={`top-${activeMovie.id}`}
            src={activeMovie.backdrop}
            alt={activeMovie.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            onAnimationComplete={() => setBaseIndex(activeIndex)}
          />
        )}
      </div>

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
        <div className="w-full md:max-w-[58%]">
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
              {activeMovie.duration > 0 && (
                <>
                  <span className="w-px h-4 bg-zinc-700" />
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    {formatDuration(activeMovie.duration)}
                  </span>
                </>
              )}
              <span className="w-px h-4 bg-zinc-700" />
              <span className="flex items-center gap-1.5">
                <OrangeGradientDefs />
                <Star className="w-3.5 h-3.5" style={{ fill: ORANGE_GRADIENT_FILL, stroke: ORANGE_GRADIENT_FILL }} />
                <span className="font-bold text-white">{formatRating(activeMovie.rating)}</span>
                <span className="text-zinc-500 text-xs">IMDb</span>
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
                onClick={() => { if (!isDragging.current) navigate(`/watch/${activeMovie.id}`); }}
                className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'rounded-xl px-6 py-3 text-sm orange-glow transition-transform hover:scale-[1.03] active:scale-[0.97]')}
              >
                <Play className="w-4 h-4 fill-white" />
                Play Now
              </button>

              <button
                onClick={() => { if (!isDragging.current) navigate(`/movie/${activeMovie.id}`); }}
                className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'rounded-xl px-6 py-3 text-sm text-white hover:bg-white/15 transition-transform hover:scale-[1.03] active:scale-[0.97]')}
              >
                <Info className="w-4 h-4" />
                More Info
              </button>
            </div>
        </div>

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
