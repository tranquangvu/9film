import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  onSearchOpen: () => void
  onSidebarToggle: () => void
}

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'Movies', to: '/movies' },
  { label: 'TV Series', to: '/tv-series' },
  { label: 'My List', to: '/my-list' },
]

export default function Navbar({ onSearchOpen, onSidebarToggle }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

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
      <div className="flex items-center justify-between px-6 md:px-12 h-16">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSidebarToggle}
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <NavLink to="/" className="text-lg font-bold tracking-tight text-gradient">
            9film
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
                  'px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200',
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
        <button
          onClick={onSearchOpen}
          className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          aria-label="Search"
        >
          <Search size={18} />
        </button>
      </div>
    </header>
  )
}
