import { memo } from "react";
import { VirtualTitleGrid } from "@/components/system/title/virtual-title-grid";
import { LoadMoreIndicator } from "@/components/system/common/load-more-indicator";
import { Empty } from "@/components/system/common/empty";
import { TitleGridSkeleton } from "@/components/system/title/skeletons";
import type { Title } from "@/types";

interface BrowseContentProps {
  isLoading: boolean;
  items: Title[];
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
        <TitleGridSkeleton />
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
          <VirtualTitleGrid
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
