import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play, TrendingUp } from 'lucide-react'
import { genres, movies } from '@/data/movies'
import { cn, formatYear } from '@/utils'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
}

const FEATURED_INDICES = [0, 4, 9]
const FEATURED_COLLECTIONS = [
  { title: 'Trending Now', subtitle: "The hottest titles everyone's watching", tag: '🔥 Hot' },
  { title: 'Award Winners', subtitle: 'Oscar nominees and festival favorites', tag: '🏆 Acclaimed' },
  { title: 'Hidden Gems', subtitle: 'Critically loved, under the radar picks', tag: '💎 Curated' },
]

export default function CategoriesPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Page header */}
      <div className="pt-24 pb-10 px-4 md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white">Categories</h1>
          <p className="text-zinc-500 mt-1 text-sm">Explore by genre and collection</p>
        </motion.div>
      </div>

      {/* Genre grid */}
      <div className="px-4 md:px-8 lg:px-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {genres.map((genre) => (
            <motion.div
              key={genre.id}
              variants={cardVariants}
              whileHover={{ scale: 1.04, zIndex: 10 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/browse?genre=${genre.id}`)}
              className="relative overflow-hidden rounded-2xl cursor-pointer group"
              style={{ height: '140px' }}
            >
              {/* Gradient background */}
              <div
                className="absolute inset-0 transition-all duration-500 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${genre.color}cc 0%, ${genre.color}66 50%, ${genre.color}22 100%)`,
                }}
              />

              {/* Subtle noise overlay for depth */}
              <div className="absolute inset-0 bg-background/30" />

              {/* Glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                style={{
                  boxShadow: `inset 0 0 60px ${genre.color}44`,
                }}
              />

              {/* Content */}
              <div className="relative h-full flex flex-col justify-between p-4">
                <div className="flex items-start justify-between">
                  <span className="text-4xl select-none">{genre.icon}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: `${genre.color}80` }}
                  >
                    {genre.count}
                  </span>
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">{genre.name}</h3>
                  <p className="text-white/60 text-xs mt-0.5">{genre.count} titles</p>
                </div>
              </div>

              {/* Border on hover */}
              <div
                className="absolute inset-0 rounded-2xl border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ borderColor: `${genre.color}80` }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Featured collections */}
      <div className="px-4 md:px-8 lg:px-12 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex items-center gap-2 mb-6"
        >
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-bold text-white">Trending Collections</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURED_COLLECTIONS.map((collection, idx) => {
            const movie = movies[FEATURED_INDICES[idx]]
            return (
              <motion.div
                key={collection.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden rounded-2xl cursor-pointer group"
                style={{ height: '200px' }}
                onClick={() => navigate('/browse')}
              >
                {/* Backdrop image */}
                <img
                  src={movie.backdrop}
                  alt={collection.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-black/20" />
                <div className="absolute inset-0 bg-linear-to-r from-black/60 to-transparent" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-5">
                  <span className="self-start text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/90 text-white">
                    {collection.tag}
                  </span>

                  <div>
                    <h3 className="text-white font-bold text-xl">{collection.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1 line-clamp-1">{collection.subtitle}</p>

                    <div className="flex items-center gap-2 mt-3">
                      <motion.button
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-400 rounded-lg text-white text-xs font-semibold transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/browse')
                        }}
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Explore
                      </motion.button>
                      <span className="text-zinc-500 text-xs">
                        {formatYear(movie.year)} · {movie.genres[0]}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
