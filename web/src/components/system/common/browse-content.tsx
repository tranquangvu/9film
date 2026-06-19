import { memo } from "react";
import { VirtualMovieGrid } from "@/components/system/movie/virtual-movie-grid";
import { LoadMoreIndicator } from "@/components/system/common/load-more-indicator";
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
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const BrowseContent = memo(function BrowseContent({
  isLoading,
  items,
  gridKey,
  emptyIcon,
  emptyTitle,
  emptyMessage,
  onClearAll,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
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
        <>
          <VirtualMovieGrid
            key={gridKey}
            items={items}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />

          {isLoadingMore && <LoadMoreIndicator className="mt-8" />}
        </>
      )}
    </div>
  );
});
