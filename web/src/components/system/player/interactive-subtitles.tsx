import { useEffect, useMemo, useRef, useState } from 'react';
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
  kind: 'word' | 'phrase';
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

// Normalize a multi-word span: lowercase, collapse spacing, trim only the outer
// punctuation so internal apostrophes/hyphens (e.g. "don't give up") survive.
function cleanPhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^a-z'’-]+|[^a-z'’-]+$/gi, '')
    .trim();
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

  // Press-start token index, so a tap (down+up on one word) saves that word while
  // a drag/swipe across words (down on one, up on another) saves the whole phrase.
  const pressAnchor = useRef<number | null>(null);

  // Clear a stale anchor if the pointer is released off any word.
  useEffect(() => {
    const clear = () => { pressAnchor.current = null; };
    window.addEventListener('pointerup', clear);
    return () => window.removeEventListener('pointerup', clear);
  }, []);

  const onWordDown = (i: number) => {
    pressAnchor.current = i;
  };

  const onWordUp = (i: number) => {
    if (!cue) return;
    const anchor = pressAnchor.current;
    pressAnchor.current = null;

    // Single word: a plain tap, or release on the same word it started on.
    if (anchor === null || anchor === i) {
      const word = cleanWord(tokens[i].value);
      if (!word) return;
      media?.pause();
      setSelection({ word, sentence: cue.text, timestamp: cue.start, kind: 'word' });
      return;
    }

    // Phrase: join every token between the two words (separators included).
    const lo = Math.min(anchor, i);
    const hi = Math.max(anchor, i);
    const phrase = cleanPhrase(tokens.slice(lo, hi + 1).map((t) => t.value).join(''));
    if (!phrase) return;
    media?.pause();
    setSelection({ word: phrase, sentence: cue.text, timestamp: cue.start, kind: phrase.includes(' ') ? 'phrase' : 'word' });
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
          <p className="pointer-events-auto inline select-none text-balance text-white text-lg md:text-2xl font-semibold [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] leading-relaxed">
            {tokens.map((t, i) =>
              t.isWord ? (
                <span
                  key={i}
                  onPointerDown={() => onWordDown(i)}
                  onPointerUp={() => onWordUp(i)}
                  className="cursor-pointer rounded px-0.5 hover:bg-orange-500/40 hover:text-orange-200 transition-colors"
                >
                  {t.value}
                </span>
              ) : (
                <span key={i}>{t.value}</span>
              ),
            )}
          </p>
          {!selection && (
            <p className="pointer-events-none mt-1 text-xs text-white/40">
              Tap a word · drag across words to save a phrase
            </p>
          )}
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
            kind={selection.kind}
            context={context}
            onClose={closePopup}
          />
        </>
      )}
    </div>
  );
}
