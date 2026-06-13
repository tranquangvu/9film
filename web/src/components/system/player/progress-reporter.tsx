/* eslint-disable react-hooks/immutability -- this file intentionally drives the
   imperative media element (seeking) returned by useMedia(). */
import { useEffect, useRef } from 'react';
import { useMedia } from '@videojs/react';

// Renders nothing — lives inside <Player.Provider> to access the media element
// via useMedia(). It seeks to a saved resume position once metadata loads, and
// reports playback position back to the watch page (throttled + on pause/unmount).
//
// All @videojs/react coupling is isolated here: we use useMedia() to get the
// underlying HTMLVideoElement and standard media events, so this keeps working
// even if the player's internal store shape shifts between beta releases.

interface ProgressReporterProps {
  /** Seconds to seek to on load (resume point). */
  startAt?: number;
  onProgress: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
}

const SAVE_INTERVAL_MS = 12_000;

export function ProgressReporter({ startAt, onProgress, onEnded }: ProgressReporterProps) {
  const media = useMedia() as HTMLMediaElement | null;

  // Keep latest callbacks in refs so changing identity doesn't re-bind listeners.
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const lastSaveRef = useRef(0);
  const seekedRef = useRef(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  });

  // Allow exactly one resume-seek per loaded media element.
  useEffect(() => {
    seekedRef.current = false;
  }, [media]);

  // Seek to the resume point once. Re-runs when startAt changes (e.g. switching
  // episode), but the seekedRef guard prevents re-seeking the same media — and
  // crucially this effect never saves, so cache patches caused by saving (which
  // change startAt) cannot loop back into a save here.
  useEffect(() => {
    if (!media) return;

    const seekToStart = () => {
      if (seekedRef.current || !startAt || startAt <= 1) return;
      if (Number.isFinite(media.duration) && media.duration > 0) {
        seekedRef.current = true;
        try {
          media.currentTime = startAt;
        } catch {
          /* seeking may not be ready yet; loadedmetadata will retry */
        }
      }
    };

    // Metadata may already be available when this mounts.
    seekToStart();
    media.addEventListener('loadedmetadata', seekToStart);
    return () => media.removeEventListener('loadedmetadata', seekToStart);
  }, [media, startAt]);

  // Report progress: throttled on timeupdate, plus on pause/ended/unmount.
  // Depends only on `media`, so the frequent saves below — which patch the
  // progress cache and thus change `startAt` — never re-bind these listeners.
  // That's what keeps the unthrottled cleanup save() from firing in a loop.
  useEffect(() => {
    if (!media) return;

    const save = () => {
      const pos = media.currentTime;
      const dur = media.duration;
      if (Number.isFinite(dur) && dur > 0 && pos > 0) {
        onProgressRef.current(pos, dur);
      }
    };

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
        lastSaveRef.current = now;
        save();
      }
    };
    const handlePause = () => save();
    const handleEnded = () => {
      save();
      onEndedRef.current?.();
    };

    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('pause', handlePause);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('ended', handleEnded);
      save();
    };
  }, [media]);

  return null;
}
