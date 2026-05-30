import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clapperboard, MoveLeft } from 'lucide-react'

import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import Footer from '@/components/layout/Footer'
import SearchOverlay from '@/components/layout/SearchOverlay'

import HomePage from '@/pages/HomePage'
import BrowsePage from '@/pages/BrowsePage'
import CategoriesPage from '@/pages/CategoriesPage'
import MovieDetailPage from '@/pages/MovieDetailPage'
import { WatchPage } from '@/pages/WatchPage'
import MyListPage from '@/pages/MyListPage'
import SearchPage from '@/pages/SearchPage'
import ProfilePage from '@/pages/ProfilePage'
import MoviesPage from '@/pages/MoviesPage'
import TvSeriesPage from '@/pages/TvSeriesPage'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <Clapperboard className="w-24 h-24 mb-6 text-orange-500" strokeWidth={1.5} />
      <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
      <p className="text-zinc-400 mb-8">The page you're looking for doesn't exist.</p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors"
      >
        <MoveLeft size={18} />
        Back to home
      </a>
    </div>
  )
}

function MainLayout() {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar
        onSearchOpen={() => setIsSearchOpen(true)}
        onSidebarToggle={() => setIsSidebarOpen(true)}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
      <main>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/tv-series" element={<TvSeriesPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/movie/:id" element={<MovieDetailPage />} />
            <Route path="/my-list" element={<MyListPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

function WatchLayout() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function AppLayout() {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')

  return isWatchPage ? <WatchLayout /> : <MainLayout />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
