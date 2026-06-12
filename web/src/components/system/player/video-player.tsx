import '@videojs/react/video/skin.css';
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

export function VideoPlayer({ src, poster, subtitle, startAt, onProgress, onEnded, learning }: VideoPlayerProps) {
  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/40 text-sm">
        No stream available
      </div>
    );
  }

  const isHls = src.includes('.m3u8');
  const playbackUrl = isHls && import.meta.env.DEV
    ? `/proxy/hls?url=${encodeURIComponent(src)}`
    : src;

  // Interactive subtitles replace the native track; otherwise fall back to it.
  const interactive = !!(learning && learning.cues.length > 0);
  const nativeTrack = subtitle && !interactive ? <SubtitleTrack subtitle={subtitle} /> : null;

  return (
    <div className="relative w-full h-full *:w-full *:h-full **:data-vjs-player:w-full **:data-vjs-player:h-full">
      <Player.Provider>
        <VideoSkin poster={poster} className="[--media-border-radius:0]">
          {isHls ? (
            <HlsVideo src={playbackUrl} playsInline>
              {nativeTrack}
            </HlsVideo>
          ) : (
            <Video src={playbackUrl} playsInline>
              {nativeTrack}
            </Video>
          )}
        </VideoSkin>
        <MediaBridge />
        {onProgress && (
          <ProgressReporter startAt={startAt} onProgress={onProgress} onEnded={onEnded} />
        )}
      </Player.Provider>
      {interactive && <InteractiveSubtitles cues={learning!.cues} context={learning!.context} />}
    </div>
  );
}
