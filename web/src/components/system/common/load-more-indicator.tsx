import { cn } from "@/utils/cn";

interface LoadMoreIndicatorProps {
  className?: string;
}

// Infinite-scroll "loading more" indicator: three orange dots bouncing in a
// staggered wave. Themed to the app's accent rather than a plain spinner.
export function LoadMoreIndicator({ className }: LoadMoreIndicatorProps) {
  return (
    <div
      className={cn("flex justify-center items-center gap-1.5 py-2", className)}
      role="status"
      aria-label="Loading more"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="loader-dot w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}
