/** OpenSubtitles uses `vi`; accept `vn` from user input. */
export function normalizeSubtitleLanguage(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (trimmed === 'vn') return 'vi';
  return trimmed;
}

export const SUBTITLE_LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt-br', label: 'Portuguese (BR)' },
  { code: 'pt-pt', label: 'Portuguese (PT)' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
  { code: 'zh-tw', label: 'Chinese (Traditional)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'sv', label: 'Swedish' },
];

export function languageOptionLabel(code: string): string {
  const normalized = normalizeSubtitleLanguage(code);
  return (
    SUBTITLE_LANGUAGE_OPTIONS.find((o) => o.code === normalized)?.label ??
    normalized.toUpperCase()
  );
}
