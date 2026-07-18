import { memo } from "react";
import { TitleVirtualGrid, TitleGridSkeleton } from "@/components/system/title/title-virtual-grid";
import { Loading } from "@/components/system/common/loading";
import { Empty } from "@/components/system/common/empty";
import type { Title } from "@/types";

interface TitleListProps {
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

export const TitleList = memo(function TitleList({
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
}: TitleListProps) {
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
          <TitleVirtualGrid
            key={gridKey}
            items={items}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />

          {isLoadingMore && <Loading className="mt-8" />}
        </>
      )}
    </div>
  );
});
