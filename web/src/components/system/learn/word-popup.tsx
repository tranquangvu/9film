import { useState } from 'react';
import { Volume2, X, BookmarkPlus, BookmarkCheck, Languages, Loader2 } from 'lucide-react';
import { useDefineQuery } from '@/hooks/queries/use-define-query';
import { useAddSavedWord, useIsWordSaved } from '@/hooks/queries/use-saved-words-query';
import { useAuth } from '@/context/auth-context';
import { translate } from '@/services/learn';

export interface WordContext {
  imdbId: string;
  season: number;
  episode: number;
  learningLang: string;
}

interface WordPopupProps {
  word: string;
  sentence: string;
  timestamp: number;
  context: WordContext;
  onClose: () => void;
}

export function WordPopup({ word, sentence, timestamp, context, onClose }: WordPopupProps) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError } = useDefineQuery(word, context.learningLang);
  const saved = useIsWordSaved(word);
  const addWord = useAddSavedWord();
  const [sentenceVi, setSentenceVi] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const audioUrl = data?.definition?.audioUrl;
  const playAudio = () => {
    if (audioUrl) void new Audio(audioUrl).play().catch(() => {});
  };

  const onTranslateSentence = async () => {
    if (sentenceVi !== null) return;
    setTranslating(true);
    try {
      setSentenceVi(await translate(sentence, context.learningLang));
    } catch {
      setSentenceVi('');
    } finally {
      setTranslating(false);
    }
  };

  const onSave = () => {
    addWord.mutate({
      word,
      sentence,
      translation: data?.translation ?? '',
      imdbId: context.imdbId,
      season: context.season,
      episode: context.episode,
      timestamp,
    });
  };

  return (
    <div className="pointer-events-auto absolute bottom-28 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)] max-h-[60vh] overflow-y-auto glass border border-white/15 rounded-2xl p-4 shadow-2xl text-white">
      {/* Header: word + phonetics + close */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold capitalize truncate">{word}</h3>
            {audioUrl && (
              <button onClick={playAudio} aria-label="Play pronunciation" className="text-orange-400 hover:text-orange-300 shrink-0">
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {data?.definition?.phonetic && (
            <p className="text-sm text-white/50">{data.definition.phonetic}</p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Vietnamese translation of the word */}
      {data?.translation && (
        <p className="mt-2 text-orange-300 font-medium">{data.translation}</p>
      )}

      {/* Definitions */}
      <div className="mt-3 space-y-2">
        {isLoading && <p className="text-sm text-white/40">Looking up…</p>}
        {isError && <p className="text-sm text-white/40">Couldn't reach the dictionary.</p>}
        {!isLoading && data && !data.definition && !data.translation && (
          <p className="text-sm text-white/40">No definition found.</p>
        )}
        {data?.definition?.meanings.slice(0, 2).map((m, mi) => (
          <div key={mi}>
            <p className="text-xs uppercase tracking-wide text-white/40">{m.partOfSpeech}</p>
            <ul className="mt-0.5 space-y-1">
              {m.definitions.slice(0, 2).map((d, di) => (
                <li key={di} className="text-sm text-white/80">
                  • {d.definition}
                  {d.example && <span className="block text-white/40 italic">“{d.example}”</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Sentence + on-demand translation */}
      {sentence && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-sm text-white/60 italic">{sentence}</p>
          {sentenceVi === null ? (
            <button
              onClick={onTranslateSentence}
              disabled={translating}
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300"
            >
              {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              Translate sentence
            </button>
          ) : (
            sentenceVi && <p className="mt-1 text-sm text-orange-300/90">{sentenceVi}</p>
          )}
        </div>
      )}

      {/* Save */}
      <div className="mt-5 flex justify-start">
        {isAuthenticated ? (
          <button
            onClick={onSave}
            disabled={saved}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-white/10 disabled:text-white/50 transition-colors"
          >
            {saved ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save'}
          </button>
        ) : (
          <span className="text-xs text-white/40">Sign in to save words</span>
        )}
      </div>
    </div>
  );
}
