import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  onSearchOpen: () => void
  onSidebarToggle: () => void
}

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'Movies', to: '/movies' },
  { label: 'TV Series', to: '/tvs' },
  { label: 'My List', to: '/my-list' },
];

export default function Navbar({ onSearchOpen, onSidebarToggle }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-500',
        scrolled ? 'glass shadow-2xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      )}
    >
      <div className="flex items-center justify-between px-4 md:px-8 lg:px-12 h-16">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onSidebarToggle}
            aria-label="Open menu"
            className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg border-0 shadow-none !bg-transparent hover:!bg-white/10 !backdrop-blur-none"
          >
            <Menu size={20} />
          </Button>

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
        <Button
          variant="ghost"
          onClick={onSearchOpen}
          aria-label="Search"
          className="p-2 -mr-2 text-zinc-400 hover:text-white rounded-lg border-0 shadow-none !bg-transparent hover:!bg-white/10 !backdrop-blur-none"
        >
          <Search size={18} />
        </Button>
      </div>
    </header>
  );
}
