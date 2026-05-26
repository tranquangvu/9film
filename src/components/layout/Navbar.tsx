import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Search, Menu, ChevronDown, X, Check, User, Settings, LogOut, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { notifications, currentUser } from '@/data/movies'

interface NavbarProps {
  onSearchOpen: () => void
  onSidebarToggle: () => void
}

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'Movies', to: '/movies' },
  { label: 'TV Shows', to: '/tv-shows' },
  { label: 'My List', to: '/my-list' },
]

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const unread = notifications.filter(n => !n.read).length
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute right-0 top-full mt-3 w-80 rounded-2xl overflow-hidden z-50"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unread > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.map(n => (
          <div
            key={n.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer',
              !n.read && 'bg-orange-500/5'
            )}
          >
            {n.thumbnail && (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <img src={n.thumbnail} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
              <p className="text-xs text-zinc-600 mt-1">{n.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-white/5">
        <button className="text-xs text-orange-500 hover:text-orange-400 font-medium flex items-center gap-1.5 transition-colors">
          <Check size={12} />
          Mark all as read
        </button>
      </div>
    </motion.div>
  )
}

function UserDropdown({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute right-0 top-full mt-3 w-56 rounded-2xl overflow-hidden z-50"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-9 h-9 rounded-xl object-cover bg-zinc-800"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Crown size={10} className="text-orange-500" />
              <p className="text-xs text-orange-500 capitalize font-medium">{currentUser.plan}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="py-1.5">
        {[
          { icon: User, label: 'Profile', action: () => navigate('/profile') },
          { icon: Settings, label: 'Settings', action: () => navigate('/settings') },
        ].map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={() => { action(); onClose() }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Icon size={15} className="text-zinc-500" />
            {label}
          </button>
        ))}
      </div>

      <div className="border-t border-white/5 py-1.5">
        <button
          onClick={onClose}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
        >
          <LogOut size={15} className="text-red-500/70" />
          Sign out
        </button>
      </div>
    </motion.div>
  )
}

export default function Navbar({ onSearchOpen, onSidebarToggle }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-500',
        scrolled ? 'glass shadow-2xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      )}
    >
      <div className="flex items-center justify-between px-4 md:px-8 h-16">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSidebarToggle}
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <NavLink to="/" className="flex items-center gap-1.5 group">
            <span className="text-lg">🎬</span>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient">NiceFilm</span>
            </span>
          </NavLink>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                  isActive
                    ? 'text-orange-500 bg-orange-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSearchOpen}
            className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(o => !o); setUserOpen(false) }}
              className="relative p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-[#0a0a0a]" />
              )}
            </button>
            <AnimatePresence>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </AnimatePresence>
          </div>

          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => { setUserOpen(o => !o); setNotifOpen(false) }}
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl hover:bg-white/5 transition-colors group"
              aria-label="Account menu"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover bg-zinc-800"
              />
              <ChevronDown
                size={14}
                className={cn(
                  'text-zinc-500 transition-transform duration-200',
                  userOpen && 'rotate-180'
                )}
              />
            </button>
            <AnimatePresence>
              {userOpen && <UserDropdown onClose={() => setUserOpen(false)} />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
