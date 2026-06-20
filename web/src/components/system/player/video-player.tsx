import '@videojs/react/video/skin.css';
import { useEffect, useState } from 'react';
import { createPlayer } from '@videojs/react';
import { videoFeatures, VideoSkin, Video } from '@videojs/react/video';
import { HlsVideo } from '@videojs/react/media/hls-video';
import type { SubtitleOption } from '@/utils/subtitle';
import { ProgressReporter } from '@/components/system/player/progress-reporter';
import { MediaBridge } from '@/components/system/player/media-context';
import { InteractiveSubtitles } from '@/components/system/player/interactive-subtitles';
import type { WordContext } from '@/components/system/learn/word-popup';
import type { Cue } from '@/utils/vtt';

const Player = createPlayer({ features: videoFeatures });

export interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  subtitle?: SubtitleOption | null;
  /** Resume position in seconds. */
  startAt?: number;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  /** When set with cues, renders clickable interactive subtitles in place of the native track. */
  learning?: { cues: Cue[]; context: WordContext } | null;
  /** While the stream is being resolved, show a blank loading state instead of "No stream available". */
  loading?: boolean;
}

// Tracks whether any element is currently fullscreen. The interactive subtitle
// overlay lives outside the fullscreened player element and so vanishes in
// fullscreen — we use this to fall back to native captions there.
function useIsFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange as EventListener);
    onChange();
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange as EventListener);
    };
  }, []);
  return fullscreen;
}

function SubtitleTrack({ subtitle }: { subtitle: SubtitleOption }) {
  return (
    <track
      kind="subtitles"
      src={`/api/subtitle/download?file_id=${subtitle.fileId}`}
      srcLang={subtitle.language}
      label={subtitle.label}
      default
    />
  );
}

export function VideoPlayer({ src, poster, subtitle, startAt, onProgress, onEnded, learning, loading }: VideoPlayerProps) {
  const fullscreen = useIsFullscreen();

  if (!src) {
    // While resolving the stream, stay blank (the watch page overlays its own
    // "Loading stream…" indicator) and only show the empty message once settled.
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/40 text-sm">
        {loading ? '' : 'No stream available'}
      </div>
    );
  }

  const isHls = src.includes('.m3u8');
  const playbackUrl = isHls && import.meta.env.DEV
    ? `/hls?url=${encodeURIComponent(src)}`
    : src;

  // Interactive subtitles replace the native track — except in fullscreen, where
  // the overlay isn't visible, so we render native captions inside the player.
  const interactive = !!(learning && learning.cues.length > 0);
  const showInteractive = interactive && !fullscreen;
  const nativeTrack = subtitle && !showInteractive ? <SubtitleTrack subtitle={subtitle} /> : null;

  return (
    <div className="relative w-full h-full *:w-full *:h-full **:data-vjs-player:w-full **:data-vjs-player:h-full">
      <Player.Provider>
        <VideoSkin poster={poster} className="[--media-border-radius:0]">
          {isHls ? (
            <HlsVideo src={playbackUrl} playsInline autoPlay>
              {nativeTrack}
            </HlsVideo>
          ) : (
            <Video src={playbackUrl} playsInline autoPlay>
              {nativeTrack}
            </Video>
          )}
        </VideoSkin>
        <MediaBridge />
        {onProgress && (
          <ProgressReporter startAt={startAt} onProgress={onProgress} onEnded={onEnded} />
        )}
      </Player.Provider>
      {showInteractive && <InteractiveSubtitles cues={learning!.cues} context={learning!.context} />}
    </div>
  );
}
