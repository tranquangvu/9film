import type { EmbedParams } from './parse-embed-path';
import { isImdbId } from './parse-embed-path';
import type { ImdbTitle } from './imdb';
import { normalizeSubtitleLanguage } from './subtitle-languages';

const SUBTITLE_DISPLAY_LIMIT = 5;

export interface SubtitleOption {
  fileId: number;
  language: string;
  label: string;
  downloadCount: number;
  release: string;
}

export interface SubtitleSearchContext {
  params: EmbedParams;
  imdbId?: string;
  languages?: string;
}

function formatTitleForRelease(titleText: string): string {
  return titleText.trim().replace(/\s+/g, '.');
}

export function buildReleasePattern(title: ImdbTitle, params: EmbedParams): string | undefined {
  const titleText = title.titleText?.text?.trim();
  if (!titleText) return undefined;

  const base = formatTitleForRelease(titleText);

  if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
    const season = String(params.season).padStart(2, '0');
    const episode = String(params.episode).padStart(2, '0');
    return `${base}.S${season}E${episode}`;
  }

  const year = title.releaseYear?.year;
  if (year != null) {
    return `${base}.${year}`;
  }

  return base;
}

function matchesReleasePattern(release: string, pattern: string): boolean {
  return release.toLowerCase().includes(pattern.toLowerCase());
}

function isBlurayRelease(release: string): boolean {
  return release.toLowerCase().includes('.bluray');
}

function sortByDownloadCount(subtitles: SubtitleOption[]): SubtitleOption[] {
  return [...subtitles].sort((a, b) => b.downloadCount - a.downloadCount);
}

export function prepareSubtitles(subtitles: SubtitleOption[]): SubtitleOption[] {
  return sortByDownloadCount(subtitles).slice(0, SUBTITLE_DISPLAY_LIMIT);
}

export function orderSubtitlesWithSelectedFirst(
  subtitles: SubtitleOption[],
  selectedFileId: number | null,
  pool: SubtitleOption[] = subtitles,
): SubtitleOption[] {
  if (selectedFileId == null) return subtitles;

  const selected = pool.find((sub) => sub.fileId === selectedFileId);
  if (!selected) return subtitles;

  const rest = subtitles.filter((sub) => sub.fileId !== selectedFileId);
  return [selected, ...rest].slice(0, SUBTITLE_DISPLAY_LIMIT);
}

/** Pick the best pattern match (BluRay first), then highest download count; fall back to top. */
export function pickSubtitleFileId(
  subtitles: SubtitleOption[],
  title: ImdbTitle,
  params: EmbedParams,
): number | null {
  const sorted = sortByDownloadCount(subtitles);
  if (sorted.length === 0) return null;

  const pattern = buildReleasePattern(title, params);
  if (pattern) {
    const matches = sorted.filter((sub) => matchesReleasePattern(sub.release, pattern));
    if (matches.length > 0) {
      const blurayMatch = matches.find((sub) => isBlurayRelease(sub.release));
      return (blurayMatch ?? matches[0]).fileId;
    }
  }

  return sorted[0].fileId;
}

export function resolveSubtitleSelection(
  subtitles: SubtitleOption[],
  title: ImdbTitle,
  params: EmbedParams,
): { list: SubtitleOption[]; fileId: number | null } {
  const sorted = sortByDownloadCount(subtitles);
  const fileId = pickSubtitleFileId(subtitles, title, params);
  const top = sorted.slice(0, SUBTITLE_DISPLAY_LIMIT);
  const list = orderSubtitlesWithSelectedFirst(top, fileId, sorted);
  return { list, fileId };
}

function buildSearchQuery(ctx: SubtitleSearchContext): string | null {
  const { params, imdbId, languages = 'en' } = ctx;
  const q = new URLSearchParams({
    type: params.mediaType,
    languages: normalizeSubtitleLanguage(languages),
  });

  if (imdbId) {
    q.set('imdb_id', imdbId);
  } else if (isImdbId(params.mediaId)) {
    q.set('imdb_id', params.mediaId);
  } else if (/^\d+$/.test(params.mediaId)) {
    q.set('tmdb_id', params.mediaId);
  } else {
    return null;
  }

  if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
    q.set('season', String(params.season));
    q.set('episode', String(params.episode));
  }

  return q.toString();
}

export async function fetchSubtitles(ctx: SubtitleSearchContext): Promise<SubtitleOption[]> {
  const query = buildSearchQuery(ctx);
  if (!query) return [];

  const res = await fetch(`/api/subtitle/search?${query}`);
  const json = (await res.json()) as {
    subtitles?: SubtitleOption[];
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? `Subtitle search failed (${res.status})`);
  }

  return json.subtitles ?? [];
}

export function subtitleVttUrl(fileId: number): string {
  return `/api/subtitle/download?file_id=${fileId}`;
}
