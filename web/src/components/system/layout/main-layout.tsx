import { useState } from 'react';
import { motion } from 'framer-motion';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import Navbar from '@/components/system/common/navbar';
import Sidebar from '@/components/system/common/sidebar';
import Footer from '@/components/system/common/footer';
import SearchOverlay from '@/components/system/common/searching';
import { SetupPrompt } from '@/components/system/common/setup-prompt';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Reset to top on navigation; restore prior position on back/forward. */}
      <ScrollRestoration />
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
      <Footer />
      <SetupPrompt />
    </div>
  );
}
