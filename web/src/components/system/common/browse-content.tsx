import { memo } from "react";
import { MovieCard } from "@/components/system/movie/movie-card";
import { Empty } from "@/components/system/common/empty";
import { MovieGridSkeleton } from "@/components/system/movie/skeletons";
import type { Movie } from "@/types";

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
      {isLoading ? (
        <MovieGridSkeleton />
      ) : items.length === 0 ? (
        <Empty
          icon={emptyIcon}
          title={emptyTitle}
          message={emptyMessage}
          actionLabel="Clear Filters"
          onAction={onClearAll}
        />
      ) : (
        <div
          key={gridKey}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8"
        >
          {items.map((movie) => (
            <MovieCard key={movie.id} movie={movie} size="lg" className="w-full" />
          ))}
        </div>
      )}
    </div>
  );
});
