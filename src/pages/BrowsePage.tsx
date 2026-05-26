import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { movies, genres } from '@/data/movies'
import { MovieCard } from '@/components/movie/MovieCard'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'
import type { SortOption } from '@/types'

const CATEGORY_TABS = ['All', 'Movies', 'TV Shows', 'Anime', 'Documentaries'] as const
type CategoryTab = (typeof CATEGORY_TABS)[number]

const YEAR_OPTIONS = [
  { label: '2024', value: '2024' },
  { label: '2023', value: '2023' },
  { label: '2022', value: '2022' },
  { label: '2021', value: '2021' },
  { label: '2020', value: '2020' },
  { label: '2019', value: '2019' },
  { label: 'Older', value: 'older' },
]

const COUNTRY_OPTIONS = [
  { label: 'USA', value: 'USA' },
  { label: 'UK', value: 'UK' },
  { label: 'Korea', value: 'Korea' },
  { label: 'Japan', value: 'Japan' },
  { label: 'France', value: 'France' },
  { label: 'Other', value: 'Other' },
]

const RATING_OPTIONS = [
  { label: '9+', value: '9' },
  { label: '8+', value: '8' },
  { label: '7+', value: '7' },
  { label: 'All', value: '' },
]

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
]

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Popularity', value: 'popularity' },
  { label: 'Rating ↓', value: 'rating' },
  { label: 'Year (Newest)', value: 'year_new' },
  { label: 'Year (Oldest)', value: 'year_old' },
  { label: 'Title A-Z', value: 'title_az' },
]

interface SelectDropdownProps {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
  allLabel?: string
}

function SelectDropdown({ label, value, options, onChange, allLabel = 'All' }: SelectDropdownProps) {
  const activeLabel = value ? options.find((o) => o.value === value)?.label : allLabel
  const isActive = Boolean(value)

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none pl-3 pr-8 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all outline-none',
          'bg-surface-2 border border-white/10 text-zinc-300 hover:border-white/20',
          isActive && 'border-orange-500/50 text-orange-400 bg-orange-500/10',
        )}
      >
        <option value="">{allLabel === 'All' ? `${label}: All` : label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      {/* Invisible but readable label for screen readers */}
      <span className="sr-only">{activeLabel}</span>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [genre, setGenre] = useState(searchParams.get('genre') ?? '')
  const [year, setYear] = useState('')
  const [country, setCountry] = useState('')
  const [rating, setRating] = useState('')
  const [language, setLanguage] = useState('')
  const [sort, setSort] = useState<SortOption>('popularity')
  const [activeTab, setActiveTab] = useState<CategoryTab>('All')
  const [filterKey, setFilterKey] = useState(0)

  useEffect(() => {
    const genreParam = searchParams.get('genre')
    if (genreParam) {
      setGenre(genreParam)
    }
  }, [searchParams])

  const hasActiveFilters = Boolean(genre || year || country || rating || language)

  const clearAll = () => {
    setGenre('')
    setYear('')
    setCountry('')
    setRating('')
    setLanguage('')
    setSort('popularity')
    setActiveTab('All')
    setSearchParams({})
    setFilterKey((k) => k + 1)
  }

  const filteredMovies = useMemo(() => {
    let result = [...movies]

    // Category tab filter
    if (activeTab === 'Movies') result = result.filter((m) => m.type === 'movie')
    else if (activeTab === 'TV Shows') result = result.filter((m) => m.type === 'series')
    else if (activeTab === 'Anime')
      result = result.filter((m) => m.genres.some((g) => g.toLowerCase() === 'anime'))
    else if (activeTab === 'Documentaries')
      result = result.filter((m) => m.genres.some((g) => g.toLowerCase() === 'documentary'))

    // Genre filter
    if (genre) {
      const genreObj = genres.find((g) => g.id === genre)
      const genreName = genreObj?.name ?? genre
      result = result.filter((m) =>
        m.genres.some((g) => g.toLowerCase() === genreName.toLowerCase()),
      )
    }

    // Year filter
    if (year) {
      result = result.filter((m) => {
        const movieYear = new Date(m.year).getFullYear()
        if (year === 'older') return movieYear < 2019
        return movieYear === parseInt(year)
      })
    }

    // Country filter
    if (country) {
      if (country === 'Other') {
        const knownCountries = ['USA', 'UK', 'Korea', 'Japan', 'France']
        result = result.filter((m) => !knownCountries.includes(m.country))
      } else {
        result = result.filter((m) => m.country === country)
      }
    }

    // Rating filter
    if (rating) {
      result = result.filter((m) => m.rating >= parseInt(rating))
    }

    // Language filter
    if (language) {
      result = result.filter((m) => m.language === language)
    }

    // Sort
    switch (sort) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      case 'year_new':
        result.sort((a, b) => new Date(b.year).getTime() - new Date(a.year).getTime())
        break
      case 'year_old':
        result.sort((a, b) => new Date(a.year).getTime() - new Date(b.year).getTime())
        break
      case 'title_az':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      default:
        result.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0))
    }

    return result
  }, [genre, year, country, rating, language, sort, activeTab])

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Page header */}
      <div className="pt-24 pb-8 px-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white">Browse</h1>
          <p className="text-zinc-500 mt-1 text-sm">Discover your next favorite film</p>
        </motion.div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-white/5 px-4 md:px-8 lg:px-12 py-3">
        {/* Category tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-500 shrink-0" />

          <SelectDropdown
            label="Genre"
            value={genre}
            options={genres.map((g) => ({ label: g.name, value: g.id }))}
            onChange={(v) => {
              setGenre(v)
              if (v) setSearchParams({ genre: v })
              else setSearchParams({})
            }}
          />

          <SelectDropdown
            label="Year"
            value={year}
            options={YEAR_OPTIONS}
            onChange={setYear}
          />

          <SelectDropdown
            label="Country"
            value={country}
            options={COUNTRY_OPTIONS}
            onChange={setCountry}
          />

          <SelectDropdown
            label="Rating"
            value={rating}
            options={RATING_OPTIONS}
            onChange={setRating}
          />

          <SelectDropdown
            label="Language"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={setLanguage}
          />

          <div className="ml-auto flex items-center gap-2">
            <SelectDropdown
              label="Sort by"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortOption)}
              allLabel="Sort: Popularity"
            />

            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-medium transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear All
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-4 md:px-8 lg:px-12 mt-6">
        {/* Result count */}
        <motion.p
          key={filteredMovies.length}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-zinc-500 text-sm mb-5"
        >
          Showing{' '}
          <span className="text-white font-semibold">{filteredMovies.length}</span>{' '}
          {filteredMovies.length === 1 ? 'title' : 'titles'}
        </motion.p>

        <AnimatePresence mode="wait">
          {filteredMovies.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon="🔍"
                title="No titles found"
                message="Try adjusting your filters to discover more content."
                actionLabel="Clear Filters"
                onAction={clearAll}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`grid-${filterKey}-${activeTab}-${genre}-${year}-${country}-${rating}-${language}-${sort}`}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5"
            >
              {filteredMovies.map((movie) => (
                <motion.div key={movie.id} variants={itemVariants}>
                  <MovieCard movie={movie} size="lg" className="w-full" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
