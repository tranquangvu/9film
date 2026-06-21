import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { TitleCard } from "@/components/system/title/title-card";
import type { Title } from "@/types";

// Mirrors the Tailwind grid breakpoints the non-virtual grid used
// (grid-cols-2 sm:3 md:4 lg:5) and its gaps (gap-6 / md:gap-8).
function columnsFor(width: number): number {
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}
function gapFor(width: number): number {
  return width >= 768 ? 32 : 24;
}

interface VirtualTitleGridProps {
  items: Title[];
  // Infinite scroll: fetch the next page as the last rows scroll into view.
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  // Show each card's watch-progress bar (Continue Watching grid).
  showProgress?: boolean;
}

// Rows from the end at which to prefetch the next page (so new items are ready
// before the user hits the very bottom).
const PREFETCH_ROWS = 2;

// Window-scrolled virtualized grid: only the visible rows (+ overscan) are
// mounted, so the DOM, image loads, and per-card query subscriptions stay
// bounded no matter how many pages are loaded. Posters are a fixed 2:3 ratio,
// so every row is the same height and we can estimate without per-row measuring.
export function VirtualTitleGrid({
  items,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  showProgress = false,
}: VirtualTitleGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
      setContainerWidth(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = columnsFor(viewportWidth);
  const gap = gapFor(viewportWidth);
  const cardWidth =
    containerWidth > 0 ? (containerWidth - (cols - 1) * gap) / cols : 0;
  // Poster is 2:3 → height = width * 1.5; add the row gap for spacing.
  const rowHeight = cardWidth > 0 ? cardWidth * 1.5 + gap : 360;
  const rowCount = Math.ceil(items.length / cols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
  });

  // Row height depends on measured width; re-measure when it changes.
  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  // Infinite scroll: when the last rendered row is within PREFETCH_ROWS of the
  // end, pull the next page. react-query no-ops if a fetch is already in flight,
  // and the hasMore/isLoadingMore guards keep us from spamming it.
  const virtualRows = virtualizer.getVirtualItems();
  const lastRowIndex = virtualRows.length ? virtualRows[virtualRows.length - 1].index : 0;
  useEffect(() => {
    if (hasMore && !isLoadingMore && lastRowIndex >= rowCount - 1 - PREFETCH_ROWS) {
      onLoadMore?.();
    }
  }, [hasMore, isLoadingMore, lastRowIndex, rowCount, onLoadMore]);

  return (
    <div
      ref={parentRef}
      style={{ position: "relative", height: virtualizer.getTotalSize() }}
    >
      {virtualRows.map((row) => {
        const start = row.index * cols;
        const rowItems = items.slice(start, start + cols);
        return (
          <div
            key={row.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap,
            }}
          >
            {rowItems.map((title) => (
              <TitleCard
                key={title.id}
                title={title}
                size="lg"
                className="w-full"
                showProgress={showProgress}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
