import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Tv, Hash, MoveRight } from 'lucide-react'
import { HeroBanner } from '@/components/movie/HeroBanner'
import { HorizontalCarousel } from '@/components/movie/HorizontalCarousel'
import {
  movies,
  continueWatching,
  trendingMovies,
  popularMovies,
  trendingShows,
  topRated,
} from '@/data/movies'
import { cn, formatYear } from '@/lib/utils'
import type { Movie } from '@/types'

// ---------------------------------------------------------------------------
// Inline search section
// ---------------------------------------------------------------------------
function QuickSearch() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results: Movie[] = query.trim()
    ? movies.filter(m => {
        const q = query.trim().toLowerCase()
        return m.id === Number(q)
          || m.title.toLowerCase().includes(q)
          || m.genres.some(g => g.toLowerCase().includes(q))
      }).slice(0, 6)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <section className="px-6 md:px-12">
      {/* CTA card */}
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-8 flex flex-col md:flex-row md:items-center gap-6"
        style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(17,17,17,0.95) 60%)',
          border: '1px solid rgba(249,115,22,0.15)',
        }}
      >
        {/* Accent glow blob */}
        <div
          className="absolute -left-10 -top-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)' }}
        />

        {/* Large background search icon — decorative */}
        <Search
          className="absolute top-1/2 -translate-y-1/2 left-0 w-32 h-32 text-orange-500/8 pointer-events-none select-none"
          aria-hidden
        />

        {/* Left */}
        <div className="relative flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Find your next watch
          </h2>
          <p className="text-zinc-500 text-sm mt-1">Explore thousands of films, series, and hidden gems</p>
        </div>

        {/* Right: input + button */}
        <form onSubmit={handleSubmit} className="relative flex items-center gap-3 w-full md:w-96 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. tt1375666, Inception"
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-zinc-500',
                'bg-white/6 border border-white/10 focus:border-orange-500/50',
                'outline-none transition-all duration-200',
              )}
            />
          </div>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors shadow-lg shadow-orange-500/30"
            aria-label="Search"
          >
            <MoveRight className="w-4 h-4" />
          </motion.button>

          {/* Dropdown results */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden z-50 text-left"
                style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {results.map(movie => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-9 h-12 rounded-lg object-cover flex-shrink-0 bg-zinc-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-500">{formatYear(movie.year)}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        {movie.type === 'series'
                          ? <Tv className="w-3 h-3 text-zinc-500" />
                          : <Film className="w-3 h-3 text-zinc-500" />}
                        <span className="text-xs text-zinc-500 capitalize">{movie.type}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Hash className="w-2.5 h-2.5" />{movie.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                      {movie.genres.slice(0, 2).map(g => (
                        <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-zinc-400">{g}</span>
                      ))}
                    </div>
                  </button>
                ))}
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 w-full px-4 py-3 border-t border-white/5 text-sm text-orange-500 hover:text-orange-400 hover:bg-white/5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  See all results for "{query}"
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

      </div>
    </section>
  )
}

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero — slides under the navbar */}
      <div className="-mt-16 md:-mt-20">
        <HeroBanner movies={trendingMovies} />
      </div>

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

        {/* Top 10 */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Top 10 Today"
            movies={topRated.slice(0, 10)}
            cardType="top10"
          />
        </AnimatedSection>

        {/* Popular Movies */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Popular Movies"
            movies={popularMovies}
          />
        </AnimatedSection>

        {/* Popular TV Series */}
        <AnimatedSection delay={0.05}>
          <HorizontalCarousel
            title="Popular TV Series"
            movies={trendingShows}
          />
        </AnimatedSection>

        {/* Quick search */}
        <AnimatedSection delay={0.05}>
          <QuickSearch />
        </AnimatedSection>
      </div>
    </div>
  )
}
