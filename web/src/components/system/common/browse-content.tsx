import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MovieCard } from "@/components/system/movie/movie-card";
import { Empty } from "@/components/system/common/empty";
import { MovieGridSkeleton } from "@/components/system/movie/skeletons";
import type { Movie } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

interface BrowseContentProps {
  isLoading: boolean;
  items: Movie[];
  gridKey: string;
  emptyIcon: string;
  emptyTitle: string;
  emptyMessage: string;
  onClearAll: () => void;
}

export const BrowseContent = memo(function BrowseContent({
  isLoading,
  items,
  gridKey,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  onClearAll,
}: BrowseContentProps) {
  return (
    <div className="px-4 md:px-8 lg:px-12 mt-6">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <MovieGridSkeleton />
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Empty
              icon={emptyIcon}
              title={emptyTitle}
              message={emptyMessage}
              actionLabel="Clear Filters"
              onAction={onClearAll}
            />
          </motion.div>
        ) : (
          <motion.div
            key={gridKey}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8"
          >
            {items.map((movie) => (
              <motion.div key={movie.id} variants={itemVariants}>
                <MovieCard movie={movie} size="lg" className="w-full" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
