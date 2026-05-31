import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { X, Crown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import { genres, currentUser } from '@/data/movies';

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navLinks = [
  { label: 'Home', to: '/', emoji: '🏠' },
  { label: 'Browse', to: '/browse', emoji: '🔍' },
  { label: 'Movies', to: '/movies', emoji: '🎬' },
  { label: 'TV Series', to: '/tv-series', emoji: '📺' },
  { label: 'My List', to: '/my-list', emoji: '📋' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col overflow-hidden"
            style={{ background: '#0f0f0f', borderRight: '1px solid rgba(255,255,255,0.06)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <NavLink to="/" onClick={onClose} className="flex items-center gap-1.5">
                <span className="text-lg">🎬</span>
                <span className="text-lg font-bold tracking-tight text-gradient">NiceFilm</span>
              </NavLink>
              <button
                onClick={onClose}
                className={cn(buttonVariants({ variant: 'ghost' }), 'p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 border-0 bg-transparent shadow-none')}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation */}
            <div className="px-3 py-4 border-b border-white/5">
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-2">Navigation</p>
              <nav className="flex flex-col gap-0.5">
                {navLinks.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'text-orange-500 bg-orange-500/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      )
                    }
                  >
                    <span className="text-base">{link.emoji}</span>
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Genres */}
            <div className="px-3 py-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-2 mb-2">Genres</p>
              <div className="flex flex-col gap-0.5">
                {genres.map(genre => (
                  <NavLink
                    key={genre.id}
                    to={`/browse?genre=${genre.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{genre.icon}</span>
                      <span>{genre.name}</span>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-medium"
                      style={{ background: `${genre.color}20`, color: genre.color }}
                    >
                      {genre.count}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* User profile */}
            <div className="px-4 py-4 border-t border-white/5">
              <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-xl object-cover bg-zinc-800 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Crown size={10} className="text-orange-500" />
                    <p className="text-xs text-orange-500 capitalize font-medium">{currentUser.plan}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
