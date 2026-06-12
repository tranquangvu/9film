/* eslint-disable react-hooks/immutability -- this panel intentionally drives the
   imperative media element (seek, loop, playbackRate) shared via MediaContext. */
import { useEffect, useRef, useState } from 'react';
import { Repeat, Play, Gauge } from 'lucide-react';
import { useMediaElement } from '@/components/system/player/media-context';
import { activeCueIndex, type Cue } from '@/utils/vtt';
import { cn } from '@/utils/cn';

const SPEEDS = [0.5, 0.75, 1] as const;

interface TranscriptPanelProps {
  cues: Cue[];
}

export function TranscriptPanel({ cues }: TranscriptPanelProps) {
  const media = useMediaElement();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loopIdx, setLoopIdx] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Track the active cue.
  useEffect(() => {
    if (!media) return;
    const update = () => setActiveIdx(activeCueIndex(cues, media.currentTime));
    update();
    media.addEventListener('timeupdate', update);
    media.addEventListener('seeked', update);
    return () => {
      media.removeEventListener('timeupdate', update);
      media.removeEventListener('seeked', update);
    };
  }, [media, cues]);

  // Loop a single line: jump back to its start whenever playback passes its end.
  useEffect(() => {
    if (!media || loopIdx === null) return;
    const cue = cues[loopIdx];
    if (!cue) return;
    const onTime = () => {
      if (media.currentTime >= cue.end || media.currentTime < cue.start - 0.5) {
        media.currentTime = cue.start;
      }
    };
    media.addEventListener('timeupdate', onTime);
    return () => media.removeEventListener('timeupdate', onTime);
  }, [media, loopIdx, cues]);

  // Keep the active line in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  const seekTo = (cue: Cue) => {
    if (!media) return;
    media.currentTime = cue.start;
    void media.play().catch(() => {});
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (media) media.playbackRate = s;
  };

  if (cues.length === 0) return null;

  return (
    <div className="glass border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[70vh]">
      {/* Header: speed control */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">Transcript</span>
        <div className="flex items-center gap-1.5 text-white/60">
          <Gauge className="w-4 h-4" />
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={cn(
                'text-xs rounded-full px-2 py-0.5 transition-colors',
                speed === s ? 'bg-orange-500 text-white' : 'hover:bg-white/10',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Cue list */}
      <div className="overflow-y-auto p-2">
        {cues.map((cue, i) => {
          const isActive = i === activeIdx;
          const isLooping = i === loopIdx;
          return (
            <div
              key={i}
              className={cn(
                'group flex items-start gap-2 rounded-lg px-2 py-1.5',
                isActive && 'bg-orange-500/15',
              )}
            >
              <button
                ref={isActive ? activeRef : undefined}
                onClick={() => seekTo(cue)}
                className={cn(
                  'flex-1 text-left text-sm leading-relaxed transition-colors',
                  isActive ? 'text-orange-200' : 'text-white/70 hover:text-white',
                )}
              >
                {cue.text}
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => seekTo(cue)}
                  aria-label="Replay line"
                  className="text-white/40 hover:text-orange-400 p-1"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setLoopIdx(isLooping ? null : i)}
                  aria-label="Loop line"
                  className={cn('p-1', isLooping ? 'text-orange-400' : 'text-white/40 hover:text-orange-400')}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
