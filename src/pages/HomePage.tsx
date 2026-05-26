import { useRef, useMemo } from 'react'
import { motion, useInView } from 'framer-motion'
import { HeroBanner } from '@/components/movie/HeroBanner'
import { HorizontalCarousel } from '@/components/movie/HorizontalCarousel'
import {
  movies,
  continueWatching,
  trendingMovies,
  newReleases,
  topRated,
  popularMovies,
  trendingShows,
} from '@/data/movies'

// ---------------------------------------------------------------------------
// Animated section wrapper — fades in when scrolled into view
// ---------------------------------------------------------------------------
interface AnimatedSectionProps {
  children: React.ReactNode
  delay?: number
}

function AnimatedSection({ children, delay = 0 }: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px 0px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// HomePage
// ---------------------------------------------------------------------------
export function HomePage() {
  // Shuffle movies for "Recommended" section (stable across renders)
  const recommended = useMemo(
    () => [...movies].sort(() => Math.random() - 0.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Hero — negative top margin so it slides under the navbar           */}
      {/* ------------------------------------------------------------------ */}
      <div className="-mt-16 md:-mt-20">
        <HeroBanner movies={trendingMovies} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content sections                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="pt-8 pb-16 space-y-12 relative z-10">

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <AnimatedSection delay={0}>
            <HorizontalCarousel
              title="Continue Watching"
              movies={continueWatching}
              cardType="backdrop"
            />
          </AnimatedSection>
        )}

        {/* Trending Now */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Trending Now"
            movies={trendingMovies}
          />
        </AnimatedSection>

        {/* Popular Movies */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Popular Movies"
            movies={popularMovies}
          />
        </AnimatedSection>

        {/* New Releases */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="New Releases"
            movies={newReleases}
          />
        </AnimatedSection>

        {/* Top Rated */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Top Rated"
            movies={topRated}
          />
        </AnimatedSection>

        {/* Recommended For You */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Recommended For You"
            movies={recommended}
          />
        </AnimatedSection>

        {/* Trending TV Shows */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Trending TV Shows"
            movies={trendingShows}
          />
        </AnimatedSection>
      </div>
    </div>
  )
}

export default HomePage
