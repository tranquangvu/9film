import type { EmbedParams } from './stream';
import type { ImdbTitle } from './title';

const LIMIT = 5;

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

export function pickSubs(
  subs: SubtitleOption[],
  title: ImdbTitle,
  params: EmbedParams,
): { list: SubtitleOption[]; fileId: number | null } {
  const sorted = [...subs].sort((a, b) => b.downloadCount - a.downloadCount);
  if (!sorted.length) return { list: [], fileId: null };

  let fileId = sorted[0].fileId;
  const name = title.titleText?.text?.trim();

  if (name) {
    const base = name.replace(/\s+/g, '.');
    let pattern = base;

    if (params.mediaType === 'tv' && params.season != null && params.episode != null) {
      const s = String(params.season).padStart(2, '0');
      const e = String(params.episode).padStart(2, '0');
      pattern = `${base}.S${s}E${e}`;
    } else if (title.releaseYear?.year != null) {
      pattern = `${base}.${title.releaseYear.year}`;
    }

    const pl = pattern.toLowerCase();
    const matches = sorted.filter((s) => s.release.toLowerCase().includes(pl));
    if (matches.length) {
      fileId = (matches.find((s) => s.release.toLowerCase().includes('.bluray')) ?? matches[0]).fileId;
    }
  }

  const top = sorted.slice(0, LIMIT);
  const selected = sorted.find((s) => s.fileId === fileId);
  const list = selected
    ? [selected, ...top.filter((s) => s.fileId !== fileId)].slice(0, LIMIT)
    : top;

  return { list, fileId };
}

export function orderSubs(subs: SubtitleOption[], fileId: number | null): SubtitleOption[] {
  if (fileId == null) return subs;

  const selected = subs.find((s) => s.fileId === fileId);
  if (!selected) return subs;

  return [selected, ...subs.filter((s) => s.fileId !== fileId)].slice(0, LIMIT);
}
