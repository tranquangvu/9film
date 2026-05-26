import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

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

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function AnimatedRoutes() {
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
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/movie/:id" element={<MovieDetailPage />} />
          <Route path="/my-list" element={<MyListPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
      <div className="text-8xl mb-6">🎬</div>
      <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
      <p className="text-zinc-400 mb-8">The page you're looking for doesn't exist.</p>
      <a
        href="/"
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold transition-colors"
      >
        Go Home
      </a>
    </div>
  )
}

function AppLayout() {
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
        <AnimatedRoutes />
      </main>
      <Footer />
    </div>
  )
}

function WatchLayout() {
  return (
    <Routes>
      <Route path="/watch/:id" element={<WatchPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteSelector />
    </BrowserRouter>
  )
}

function RouteSelector() {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')

  if (isWatchPage) {
    return <WatchLayout />
  }

  return <AppLayout />
}
