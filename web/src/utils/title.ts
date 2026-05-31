import type { EmbedParams, MediaType } from './stream';

export interface ImdbTitle {
  id?: string;
  titleText?: { text?: string };
  originalTitleText?: { text?: string };
  titleType?: { id?: string; text?: string; canHaveEpisodes?: boolean };
  releaseYear?: { year?: number; endYear?: number | null };
  primaryImage?: { url?: string; width?: number; height?: number };
  plot?: { plotText?: { plainText?: string } };
  ratingsSummary?: { aggregateRating?: number; voteCount?: number };
  runtime?: { seconds?: number };
  genres?: { genres?: Array<{ text?: string }> };
  countriesOfOrigin?: { countries?: Array<{ text?: string }> };
  spokenLanguages?: {
    spokenLanguages?: Array<{ id?: string; text?: string }>;
  };
}

export interface OriginalLanguage {
  code: string;
  label: string;
}

const TV_TYPES = new Set<string>(['tvSeries', 'tvMiniSeries', 'tvSpecial', 'tvMovie']);

const LANG_MAP: Record<string, string> = {
  cn: 'zh-cn',
  tw: 'zh-tw',
  pb: 'pt-br',
  pt: 'pt-pt',
};

export function normId(id: string): string {
  return id.startsWith('tt') ? id : `tt${id}`;
}

export function embedParams(title: ImdbTitle, mediaId: string): EmbedParams {
  const typeId = title.titleType?.id;
  const mediaType: MediaType = typeId && TV_TYPES.has(typeId) ? 'tv' : 'movie';
  return { mediaType, mediaId: title.id ?? normId(mediaId) };
}

export function origLang(title: ImdbTitle): OriginalLanguage {
  const primary = title.spokenLanguages?.spokenLanguages?.[0];
  if (!primary?.id) throw new Error('No original language found on IMDb');

  const raw = primary.id.trim().toLowerCase();
  const code = LANG_MAP[raw] ?? raw.split('-')[0] ?? raw;
  return { code, label: primary.text ?? code.toUpperCase() };
}
