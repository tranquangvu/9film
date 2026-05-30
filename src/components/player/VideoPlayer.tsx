import '@videojs/react/video/skin.css'
import { createPlayer } from '@videojs/react'
import { videoFeatures, VideoSkin, Video } from '@videojs/react/video'

const Player = createPlayer({ features: videoFeatures })

export interface VideoPlayerProps {
  src: string
  poster?: string
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  return (
    <div className="w-full h-full *:w-full *:h-full **:data-vjs-player:w-full **:data-vjs-player:h-full">
      <Player.Provider>
        <VideoSkin poster={poster}>
          <Video src={src} playsInline />
        </VideoSkin>
      </Player.Provider>
    </div>
  )
}
