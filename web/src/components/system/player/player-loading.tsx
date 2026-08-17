import { useCallback, useSyncExternalStore } from 'react';
import { AlertCircle } from 'lucide-react';
import { useMediaElement } from '@/components/system/player/media-context';

interface PlayerLoadingProps {
  title: string | null;
  poster?: string;
  /** The stream URL is still being resolved by /api/stream. */
  resolving: boolean;
  /** Resolution failed — show the reason instead of a spinner. */
  blocked: boolean;
  error: string | null;
  /** False before there is a URL to load, so the media gate stays off. */
  hasStream: boolean;
}

/**
 * True once the media has metadata (or has given up), false again whenever a
 * new source starts loading.
 *
 * Metadata is the first moment the player has anything to show: before it, the
 * duration reads 0:00 and the poster is all there is. `emptied`/`loadstart`
 * bring the cover back when the episode changes, and `error` lifts it rather
 * than spinning forever over a stream that will never arrive.
 */
function useMediaLoaded(media: HTMLMediaElement | null): boolean {
  // Read straight off the element rather than mirroring it into state: it may
  // already hold metadata by the time this subscribes (an episode switch reuses
  // the element), and a stale `false` would flash the cover back over a running
  // film.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!media) return () => {};
      const events = ['loadstart', 'emptied', 'loadedmetadata', 'error'] as const;
      events.forEach((e) => media.addEventListener(e, onChange));
      return () => events.forEach((e) => media.removeEventListener(e, onChange));
    },
    [media],
  );

  const read = useCallback(
    () => !!media && (media.readyState >= HTMLMediaElement.HAVE_METADATA || !!media.error),
    [media],
  );

  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Covers the player until there is something to watch: first while the stream
 * URL is resolved, then while the manifest and its first segments come down.
 *
 * That second half is the part the player can't cover itself. @videojs's own
 * buffering indicator is gated on `waiting && !paused`
 * (buffering-indicator-core), and nothing is unpaused until playback has
 * actually started — so a slow first load sat behind the poster at 0:00 with no
 * sign that anything was happening.
 *
 * Click-through on purpose: if a stream never loads, the play button underneath
 * has to stay reachable.
 */
export function PlayerLoading({
  title,
  poster,
  resolving,
  blocked,
  error,
  hasStream,
}: PlayerLoadingProps) {
  const loaded = useMediaLoaded(useMediaElement());
  if (!blocked && !resolving && (!hasStream || loaded)) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden pointer-events-none">
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl scale-110"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/50" />
      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        {blocked ? (
          <AlertCircle className="w-12 h-12 text-orange-400/80" />
        ) : (
          <div className="w-12 h-12 rounded-full border-[3px] border-white/15 border-t-orange-500 animate-spin" />
        )}
        <div>
          <p className="text-white font-semibold text-base md:text-lg leading-tight">
            {title ?? 'Loading'}
          </p>
          <p className="text-white/55 text-sm mt-1.5">
            {blocked
              ? (error ?? 'Unable to load stream')
              : resolving
                ? 'Preparing your stream…'
                : 'Loading the video…'}
          </p>
        </div>
      </div>
    </div>
  );
}
