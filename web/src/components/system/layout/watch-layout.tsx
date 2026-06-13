import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function WatchLayout() {
  const location = useLocation();

  return (
    <>
    <ScrollRestoration />
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
    </>
  );
}
