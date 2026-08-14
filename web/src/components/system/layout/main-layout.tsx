import { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { TopNavbar, LeftNavbar } from '@/components/system/common/navbar';
import SearchOverlay from '@/components/system/common/search';

const footerLinks = [
  { label: 'About', to: '/about' },
  { label: 'Disclaimer', to: '/disclaimer' },
];

// A keyed motion.div that remounts on each route change and replays its enter
// animation. We deliberately avoid AnimatePresence's `mode="wait"` exit gating:
// under React StrictMode it can leave the entering page pinned at opacity 0
// (content renders, then vanishes), since the entrance waits on an
// exit-complete callback the double-mount never fires.
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function MainLayout() {
  const location = useLocation();
  const [isLeftNavbarOpen, setIsLeftNavbarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Reset to top on navigation; restore prior position on back/forward. */}
      <ScrollRestoration />
      <TopNavbar
        onSearchOpen={() => setIsSearchOpen(true)}
        onLeftNavbarOpen={() => setIsLeftNavbarOpen(true)}
      />
      <LeftNavbar
        isOpen={isLeftNavbarOpen}
        onClose={() => setIsLeftNavbarOpen(false)}
      />
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
      <main>
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
      <footer className="border-t border-white/5 bg-[#0a0a0a]">
        <div className="px-6 md:px-12 py-8 flex items-center justify-between">
          <NavLink to="/" className="text-base font-bold tracking-tight text-gradient">
            9film
          </NavLink>

          {/* Two static pages: what the app is, and the rights/data notice. */}
          <nav className="flex items-center gap-5">
            {footerLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className="text-xs text-zinc-500 hover:text-orange-500 transition-colors"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
