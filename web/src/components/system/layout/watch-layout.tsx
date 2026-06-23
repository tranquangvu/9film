import { motion } from 'framer-motion';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

// Keyed enter-only transition — see main-layout.tsx for why AnimatePresence's
// `mode="wait"` exit gating is avoided (it strands the entering page at
// opacity 0 under React StrictMode).
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function WatchLayout() {
  const location = useLocation();

  return (
    <>
    <ScrollRestoration />
    <motion.div
      key={location.pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <Outlet />
    </motion.div>
    </>
  );
}
