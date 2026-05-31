import '@videojs/react/video/skin.css';
import { createPlayer } from '@videojs/react';
import { videoFeatures, VideoSkin, Video } from '@videojs/react/video';
import { HlsVideo } from '@videojs/react/media/hls-video';
import type { SubtitleOption } from '@/utils/subtitle';

const Player = createPlayer({ features: videoFeatures });

export interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  subtitle?: SubtitleOption | null;
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

export function VideoPlayer({ src, poster, subtitle }: VideoPlayerProps) {
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

  return (
    <div className="w-full h-full *:w-full *:h-full **:data-vjs-player:w-full **:data-vjs-player:h-full">
      <Player.Provider>
        <VideoSkin poster={poster} className="[--media-border-radius:0]">
          {isHls ? (
            <HlsVideo src={playbackUrl} playsInline>
              {subtitle && <SubtitleTrack subtitle={subtitle} />}
            </HlsVideo>
          ) : (
            <Video src={playbackUrl} playsInline>
              {subtitle && <SubtitleTrack subtitle={subtitle} />}
            </Video>
          )}
        </VideoSkin>
      </Player.Provider>
    </div>
  );
}
