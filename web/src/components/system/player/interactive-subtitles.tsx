import { useEffect, useMemo, useState } from 'react';
import { useMediaElement } from '@/components/system/player/media-context';
import { WordPopup, type WordContext } from '@/components/system/learn/word-popup';
import { activeCueIndex, type Cue } from '@/utils/vtt';

interface InteractiveSubtitlesProps {
  cues: Cue[];
  context: WordContext;
}

interface Selection {
  word: string;
  sentence: string;
  timestamp: number;
}

// Splits a cue into word / non-word tokens so punctuation and spacing render
// verbatim while each word stays individually clickable.
function tokenize(text: string): { value: string; isWord: boolean }[] {
  return text.split(/([A-Za-z][A-Za-z'’-]*)/).map((value, i) => ({
    value,
    isWord: i % 2 === 1, // capture groups land on odd indices
  }));
}

// Strip surrounding punctuation/possessives for a clean dictionary lookup.
function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/['’]s$/, '').replace(/^[-'’]+|[-'’]+$/g, '');
}

export function InteractiveSubtitles({ cues, context }: InteractiveSubtitlesProps) {
  const media = useMediaElement();
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selection, setSelection] = useState<Selection | null>(null);

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

  // Esc closes the popup (and resumes playback).
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setSelection(null);
      if (media?.paused) void media.play().catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, media]);

  const cue = activeIdx >= 0 ? cues[activeIdx] : null;
  const tokens = useMemo(() => (cue ? tokenize(cue.text) : []), [cue]);

  const onWordClick = (raw: string) => {
    if (!cue) return;
    const word = cleanWord(raw);
    if (!word) return;
    media?.pause();
    setSelection({ word, sentence: cue.text, timestamp: cue.start });
  };

  // Close the popup and resume playback (clicking a word paused it).
  const closePopup = () => {
    setSelection(null);
    if (media?.paused) void media.play().catch(() => {});
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {cue && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[85%] text-center">
          <p className="pointer-events-auto inline text-balance text-white text-lg md:text-2xl font-semibold [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] leading-relaxed">
            {tokens.map((t, i) =>
              t.isWord ? (
                <span
                  key={i}
                  onClick={() => onWordClick(t.value)}
                  className="cursor-pointer rounded px-0.5 hover:bg-orange-500/40 hover:text-orange-200 transition-colors"
                >
                  {t.value}
                </span>
              ) : (
                <span key={i}>{t.value}</span>
              ),
            )}
          </p>
        </div>
      )}

      {selection && (
        <>
          {/* Click-catcher: tapping outside the popup closes it and resumes play. */}
          <div className="pointer-events-auto absolute inset-0" onClick={closePopup} />
          <WordPopup
            word={selection.word}
            sentence={selection.sentence}
            timestamp={selection.timestamp}
            context={context}
            onClose={closePopup}
          />
        </>
      )}
    </div>
  );
}
