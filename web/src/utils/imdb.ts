import type { EmbedParams, MediaType } from './parse-embed-path';

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

function normalizeImdbId(imdbId: string): string {
  return imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
}

export function titleTypeToMedia(typeId: string | undefined): MediaType {
  if (!typeId) return 'movie';
  const tvTypes = ['tvSeries', 'tvMiniSeries', 'tvSpecial', 'tvMovie'];
  return tvTypes.includes(typeId) ? 'tv' : 'movie';
}

export function embedParamsFromTitle(title: ImdbTitle, mediaId: string): EmbedParams {
  const id = title.id ?? normalizeImdbId(mediaId);
  return {
    mediaType: titleTypeToMedia(title.titleType?.id),
    mediaId: id,
  };
}

/** Map IMDb spoken language id to OpenSubtitles language code. */
export function imdbLanguageToOpenSubtitles(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === 'cn') return 'zh-cn';
  if (normalized === 'tw') return 'zh-tw';
  if (normalized === 'pb') return 'pt-br';
  if (normalized === 'pt') return 'pt-pt';
  return normalized.split('-')[0] ?? normalized;
}

export function originalLanguageFromTitle(title: ImdbTitle): OriginalLanguage {
  const primary = title.spokenLanguages?.spokenLanguages?.[0];
  if (!primary?.id) {
    throw new Error('No original language found on IMDb');
  }

  const code = imdbLanguageToOpenSubtitles(primary.id);
  return {
    code,
    label: primary.text ?? code.toUpperCase(),
  };
}

export async function fetchTitle(imdbId: string): Promise<ImdbTitle> {
  const id = encodeURIComponent(normalizeImdbId(imdbId));
  const res = await fetch(`/api/titles/${id}`);
  const json = (await res.json()) as ImdbTitle & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Title details failed (${res.status})`);
  }

  if (!json.id) {
    throw new Error('No title details returned');
  }

  return json;
}

export async function fetchOriginalLanguage(imdbId: string): Promise<OriginalLanguage> {
  const title = await fetchTitle(imdbId);
  return originalLanguageFromTitle(title);
}
