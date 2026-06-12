/* eslint-disable react-refresh/only-export-components -- context + hooks colocated by design */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMedia } from '@videojs/react';

// Bridges the raw HTMLMediaElement out of <Player.Provider> so components that
// live elsewhere on the watch page (the transcript panel, the interactive
// subtitle overlay) can drive playback — seek, loop, playbackRate — without each
// of them coupling to @videojs internals. Only <MediaBridge> touches useMedia().

interface MediaCtx {
  media: HTMLMediaElement | null;
  setMedia: (m: HTMLMediaElement | null) => void;
}

const MediaContext = createContext<MediaCtx>({ media: null, setMedia: () => {} });

export function MediaProvider({ children }: { children: ReactNode }) {
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  return <MediaContext.Provider value={{ media, setMedia }}>{children}</MediaContext.Provider>;
}

/** Read the current media element (null until the player mounts). */
export function useMediaElement(): HTMLMediaElement | null {
  return useContext(MediaContext).media;
}

/** Renders nothing; lives inside <Player.Provider> to publish the element. */
export function MediaBridge() {
  const media = useMedia() as HTMLMediaElement | null;
  const { setMedia } = useContext(MediaContext);
  useEffect(() => {
    setMedia(media);
    return () => setMedia(null);
  }, [media, setMedia]);
  return null;
}
