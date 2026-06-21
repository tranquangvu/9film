/* eslint-disable react-hooks/immutability -- this panel intentionally drives the
   imperative media element (seek, loop, playbackRate) shared via MediaContext. */
import { useEffect, useRef, useState } from 'react';
import { Repeat, CirclePlay } from 'lucide-react';
import { useMediaElement } from '@/components/system/player/media-context';
import { activeCueIndex, type Cue } from '@/utils/vtt';
import { cn } from '@/utils/cn';


interface TranscriptPanelProps {
  cues: Cue[];
}

export function TranscriptPanel({ cues }: TranscriptPanelProps) {
  const media = useMediaElement();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loopIdx, setLoopIdx] = useState<number | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  // Keep the active line near the top of the scroll container as playback advances.
  useEffect(() => {
    const list = listRef.current;
    const el = activeRef.current;
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Only scroll once the active line nears the bottom edge of the view;
    // while it sits comfortably in view, leave the scroll position alone.
    if (elRect.bottom < listRect.bottom - 48) return;
    // Re-anchor the active line a little below the top edge for breathing room.
    const offset = elRect.top - listRect.top + list.scrollTop - 12;
    list.scrollTo({ top: offset, behavior: 'smooth' });
  }, [activeIdx]);

  const seekTo = (cue: Cue) => {
    if (!media) return;
    media.currentTime = cue.start;
    void media.play().catch(() => {});
  };

  if (cues.length === 0) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5 space-y-px">
        {cues.map((cue, i) => {
          const isActive = i === activeIdx;
          const isLooping = i === loopIdx;
          return (
            <div
              key={i}
              className={cn(
                'group flex items-start gap-1.5 rounded-md px-2 py-1.5 transition-colors',
                isActive
                  ? 'bg-orange-500/12'
                  : 'hover:bg-white/[0.04]',
              )}
            >
              <button
                ref={isActive ? activeRef : undefined}
                onClick={() => seekTo(cue)}
                className={cn(
                  'flex-1 text-left text-[13px] leading-snug tracking-[-0.01em] transition-colors',
                  isActive ? 'text-orange-200/90' : 'text-white/50 hover:text-white/80',
                )}
              >
                {cue.text}
              </button>
              <div className="flex items-center gap-0.5 self-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => seekTo(cue)}
                  aria-label="Replay line"
                  className="text-white/30 hover:text-white/70 p-1 rounded transition-colors hover:bg-white/[0.06]"
                >
                  <CirclePlay className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setLoopIdx(isLooping ? null : i)}
                  aria-label="Loop line"
                  className={cn(
                    'p-1 rounded transition-colors',
                    isLooping
                      ? 'text-orange-400'
                      : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06]',
                  )}
                >
                  <Repeat className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
