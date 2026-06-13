import { memo } from "react";
import { Loader2 } from "lucide-react";
import { VirtualMovieGrid } from "@/components/system/movie/virtual-movie-grid";
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

          {isLoadingMore && (
            <div className="flex justify-center mt-8 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  );
});
